using System;
using System.Collections.Generic;
using System.Data;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Data.Sqlite;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Dunvex
{
    // ─── Native High-Performance SQLite Manager (Windows Embedded) ─
    public class SQLiteManager
    {
        private static readonly Lazy<SQLiteManager> _instance = new(() => new SQLiteManager());
        public static SQLiteManager Shared => _instance.Value;

        private string _dbPath;
        private string _connectionString;
        private readonly object _lock = new();

        public string DbPath
        {
            get { lock (_lock) return _dbPath; }
        }
        public string DataDirectory
        {
            get { lock (_lock) return Path.GetDirectoryName(_dbPath)!; }
        }
        public object SyncLock => _lock;

        public SQLiteManager()
        {
            string dunvexDir = GetConfiguredDataDirectory();
            Directory.CreateDirectory(dunvexDir);

            _dbPath = Path.Combine(dunvexDir, "dunvex_local.sqlite");
            _connectionString = CreateConnectionString(_dbPath);

            InitDatabase();
        }

        private static string DefaultDataDirectory =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Dunvex");

        private static string StorageSettingsPath =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Dunvex", "storage-location.json");

        private static string GetConfiguredDataDirectory()
        {
            string settingsPath = StorageSettingsPath;
            if (!File.Exists(settingsPath)) return DefaultDataDirectory;

            using var document = JsonDocument.Parse(File.ReadAllText(settingsPath));
            if (!document.RootElement.TryGetProperty("dataDirectory", out var directoryValue) ||
                directoryValue.ValueKind != JsonValueKind.String ||
                string.IsNullOrWhiteSpace(directoryValue.GetString()))
            {
                throw new InvalidDataException("Cấu hình vị trí lưu dữ liệu Dunvex không hợp lệ.");
            }

            string configuredDirectory = Path.GetFullPath(directoryValue.GetString()!);
            if (!Directory.Exists(configuredDirectory))
            {
                throw new DirectoryNotFoundException($"Không tìm thấy ổ/thư mục lưu dữ liệu: {configuredDirectory}");
            }
            return configuredDirectory;
        }

        private static string CreateConnectionString(string dbPath) =>
            $"Data Source={dbPath};Mode=ReadWriteCreate;Cache=Shared;";

        private SqliteConnection OpenConnection()
        {
            var connection = new SqliteConnection(_connectionString);
            try
            {
                connection.Open();
                using var command = connection.CreateCommand();
                command.CommandText = "PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;";
                command.ExecuteNonQuery();
                return connection;
            }
            catch
            {
                connection.Dispose();
                throw;
            }
        }

        public string ChangeStorageLocation(string selectedParentDirectory)
        {
            string parentDirectory = Path.GetFullPath(selectedParentDirectory);
            if (!Directory.Exists(parentDirectory))
                throw new DirectoryNotFoundException("Thư mục đã chọn không còn tồn tại.");

            lock (_lock)
            {
                string currentDirectory = DataDirectory;
                string targetDirectory = Path.Combine(parentDirectory, "DunvexData");
                if (string.Equals(currentDirectory, targetDirectory, StringComparison.OrdinalIgnoreCase))
                    return _dbPath;
                if (targetDirectory.StartsWith(currentDirectory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Không thể chọn thư mục con bên trong vị trí Dunvex hiện tại.");
                if (Directory.Exists(targetDirectory) && Directory.GetFileSystemEntries(targetDirectory).Length > 0)
                    throw new IOException("Thư mục đã chọn có sẵn dữ liệu Dunvex. Hãy chọn một thư mục khác để tránh ghi đè.");

                string stagingDirectory = Path.Combine(parentDirectory, $".Dunvex-migration-{Guid.NewGuid():N}");
                string targetDbPath = Path.Combine(targetDirectory, "dunvex_local.sqlite");
                bool destinationCreated = false;
                try
                {
                    using (var checkpointConnection = OpenConnection())
                    {
                        using var checkpoint = checkpointConnection.CreateCommand();
                        checkpoint.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);";
                        using var result = checkpoint.ExecuteReader();
                        if (!result.Read() || result.GetInt32(0) != 0)
                            throw new IOException("SQLite đang bận; chưa thể di chuyển dữ liệu an toàn.");
                    }

                    Directory.CreateDirectory(stagingDirectory);
                    if (!File.Exists(_dbPath))
                        throw new FileNotFoundException("Không tìm thấy cơ sở dữ liệu SQLite hiện tại.", _dbPath);
                    File.Copy(_dbPath, Path.Combine(stagingDirectory, "dunvex_local.sqlite"));

                    string sourceImages = Path.Combine(currentDirectory, "images");
                    if (Directory.Exists(sourceImages))
                    {
                        CopyDirectory(sourceImages, Path.Combine(stagingDirectory, "images"));
                        if (GetDirectoryStats(sourceImages) != GetDirectoryStats(Path.Combine(stagingDirectory, "images")))
                            throw new IOException("Không thể xác minh đầy đủ ảnh offline sau khi sao chép.");
                    }

                    ValidateDatabase(Path.Combine(stagingDirectory, "dunvex_local.sqlite"));

                    if (Directory.Exists(targetDirectory))
                        Directory.Delete(targetDirectory);
                    Directory.Move(stagingDirectory, targetDirectory);
                    destinationCreated = true;
                    SaveConfiguredDataDirectory(targetDirectory);

                    string oldDbPath = _dbPath;
                    _dbPath = targetDbPath;
                    _connectionString = CreateConnectionString(_dbPath);
                    destinationCreated = false;

                    try
                    {
                        DeleteIfExists(oldDbPath);
                        DeleteIfExists(oldDbPath + "-wal");
                        DeleteIfExists(oldDbPath + "-shm");
                        string oldImages = Path.Combine(currentDirectory, "images");
                        if (Directory.Exists(oldImages))
                            Directory.Delete(oldImages, recursive: true);
                    }
                    catch (Exception cleanupError)
                    {
                        Debug.WriteLine($"[Storage] Old location cleanup failed after successful migration: {cleanupError}");
                    }
                    return _dbPath;
                }
                catch
                {
                    if (Directory.Exists(stagingDirectory))
                        Directory.Delete(stagingDirectory, recursive: true);
                    if (destinationCreated && Directory.Exists(targetDirectory))
                    {
                        try { Directory.Delete(targetDirectory, recursive: true); }
                        catch (Exception cleanupError)
                        {
                            Debug.WriteLine($"[Storage] Failed to clean up an uncommitted destination: {cleanupError}");
                        }
                    }
                    throw;
                }
            }
        }

        private static void SaveConfiguredDataDirectory(string directory)
        {
            string settingsPath = StorageSettingsPath;
            Directory.CreateDirectory(Path.GetDirectoryName(settingsPath)!);
            string temporaryPath = settingsPath + ".tmp";
            try
            {
                File.WriteAllText(temporaryPath, JsonSerializer.Serialize(new { dataDirectory = directory }));
                if (File.Exists(settingsPath))
                    File.Replace(temporaryPath, settingsPath, null);
                else
                    File.Move(temporaryPath, settingsPath);
            }
            catch
            {
                DeleteIfExists(temporaryPath);
                throw;
            }
        }

        private static void ValidateDatabase(string dbPath)
        {
            using var connection = new SqliteConnection(CreateConnectionString(dbPath));
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA integrity_check;";
            if (!string.Equals(command.ExecuteScalar()?.ToString(), "ok", StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("SQLite không vượt qua kiểm tra toàn vẹn sau khi sao chép.");
        }

        private static void CopyDirectory(string source, string destination)
        {
            Directory.CreateDirectory(destination);
            foreach (string file in Directory.GetFiles(source))
                File.Copy(file, Path.Combine(destination, Path.GetFileName(file)));
            foreach (string directory in Directory.GetDirectories(source))
                CopyDirectory(directory, Path.Combine(destination, Path.GetFileName(directory)));
        }

        private static (int count, long bytes) GetDirectoryStats(string directory)
        {
            int count = 0;
            long bytes = 0;
            if (!Directory.Exists(directory)) return (count, bytes);
            foreach (string file in Directory.GetFiles(directory, "*", SearchOption.AllDirectories))
            {
                count++;
                bytes += new FileInfo(file).Length;
            }
            return (count, bytes);
        }

        private static void DeleteIfExists(string path)
        {
            if (File.Exists(path)) File.Delete(path);
        }

        private void InitDatabase()
        {
            lock (_lock)
            {
                using var conn = OpenConnection();

                using (var pragmaCmd = conn.CreateCommand())
                {
                    pragmaCmd.CommandText = "PRAGMA journal_mode = WAL;";
                    pragmaCmd.ExecuteNonQuery();
                }

                string sql = @"
                CREATE TABLE IF NOT EXISTS customers (
                    id TEXT PRIMARY KEY,
                    customer_code TEXT,
                    name TEXT,
                    phone TEXT,
                    address TEXT,
                    sync_status INTEGER DEFAULT 0,
                    updated_at INTEGER DEFAULT 0,
                    is_deleted INTEGER DEFAULT 0,
                    ownerId TEXT,
                    data_json TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(ownerId);
                CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
                CREATE INDEX IF NOT EXISTS idx_customers_sync ON customers(sync_status);

                CREATE TABLE IF NOT EXISTS products (
                    id TEXT PRIMARY KEY,
                    product_code TEXT,
                    name TEXT,
                    unit TEXT,
                    base_price REAL DEFAULT 0,
                    local_image_path TEXT,
                    sync_status INTEGER DEFAULT 0,
                    updated_at INTEGER DEFAULT 0,
                    is_deleted INTEGER DEFAULT 0,
                    ownerId TEXT,
                    data_json TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_products_owner ON products(ownerId);
                CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
                CREATE INDEX IF NOT EXISTS idx_products_sync ON products(sync_status);

                CREATE TABLE IF NOT EXISTS orders (
                    id TEXT PRIMARY KEY,
                    order_code TEXT,
                    customer_id TEXT,
                    total_amount REAL DEFAULT 0,
                    note TEXT,
                    is_printed INTEGER DEFAULT 0,
                    local_image_path TEXT,
                    image_sync_status INTEGER DEFAULT 0,
                    sync_status INTEGER DEFAULT 0,
                    created_at INTEGER DEFAULT 0,
                    updated_at INTEGER DEFAULT 0,
                    is_deleted INTEGER DEFAULT 0,
                    ownerId TEXT,
                    data_json TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders(ownerId);
                CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
                CREATE INDEX IF NOT EXISTS idx_orders_sync ON orders(sync_status);

                CREATE TABLE IF NOT EXISTS order_items (
                    id TEXT PRIMARY KEY,
                    order_id TEXT,
                    product_id TEXT,
                    quantity REAL DEFAULT 0,
                    unit_price REAL DEFAULT 0,
                    amount REAL DEFAULT 0,
                    sync_status INTEGER DEFAULT 0,
                    updated_at INTEGER DEFAULT 0,
                    product_name TEXT,
                    unit TEXT,
                    ownerId TEXT,
                    data_json TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
                CREATE INDEX IF NOT EXISTS idx_order_items_sync ON order_items(sync_status);

                CREATE TABLE IF NOT EXISTS generic_documents (
                    composite_key TEXT PRIMARY KEY,
                    collection TEXT,
                    id TEXT,
                    sync_status INTEGER DEFAULT 0,
                    updated_at INTEGER DEFAULT 0,
                    ownerId TEXT,
                    data_json TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_generic_col ON generic_documents(collection);
                CREATE INDEX IF NOT EXISTS idx_generic_owner ON generic_documents(ownerId);
                CREATE INDEX IF NOT EXISTS idx_generic_sync ON generic_documents(sync_status);

                CREATE TABLE IF NOT EXISTS app_metadata (
                    key_name TEXT PRIMARY KEY,
                    key_value TEXT
                );";

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = sql;
                    cmd.ExecuteNonQuery();
                }
            }
        }

        private static readonly HashSet<string> _allowedTables = new(StringComparer.OrdinalIgnoreCase)
        {
            "customers", "products", "orders", "order_items", "generic_documents", "app_metadata",
            "users", "settings", "inventory_transactions", "leaves", "attendance_logs", "audit_logs"
        };

        public static bool IsSafeSqlStatement(string sql)
        {
            string trimmed = sql.Trim();
            if (string.IsNullOrEmpty(trimmed)) return false;

            string cleanSql = trimmed.EndsWith(';') ? trimmed[..^1].Trim() : trimmed;

            // Disallow statement stacking and comments
            if (cleanSql.Contains(';') || cleanSql.Contains("--") || cleanSql.Contains("/*"))
                return false;

            string upper = cleanSql.ToUpperInvariant();

            // Disallow dangerous keywords
            string[] forbidden = new[]
            {
                "ATTACH", "DETACH", "DROP", "ALTER", "CREATE", "PRAGMA", "VACUUM",
                "LOAD_EXTENSION", "XP_", "EXEC", "SHUTDOWN", "REINDEX", "GRANT", "REVOKE", "TRUNCATE"
            };

            foreach (var kw in forbidden)
            {
                if (upper == kw || upper.StartsWith(kw + " ") || upper.Contains(" " + kw + " ") || upper.EndsWith(" " + kw))
                    return false;
            }

            bool isAllowedVerb = upper.StartsWith("SELECT") ||
                                upper.StartsWith("INSERT") ||
                                upper.StartsWith("UPDATE") ||
                                upper.StartsWith("DELETE");
            if (!isAllowedVerb) return false;

            // Must target one of the predefined whitelist tables
            bool matchesAllowedTable = false;
            foreach (var table in _allowedTables)
            {
                if (upper.Contains(table.ToUpperInvariant()))
                {
                    matchesAllowedTable = true;
                    break;
                }
            }

            return matchesAllowedTable;
        }

        public (int rowsAffected, long lastInsertId, string? error) Execute(string sql, List<object?>? parameters)
        {
            if (!IsSafeSqlStatement(sql))
            {
                return (0, 0, "SQL statement blocked by security policy (Invalid verb or forbidden keyword)");
            }

            lock (_lock)
            {
                try
                {
                    using var conn = OpenConnection();

                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = sql;
                    BindParameters(cmd, parameters);

                    int rows = cmd.ExecuteNonQuery();

                    using var idCmd = conn.CreateCommand();
                    idCmd.CommandText = "SELECT last_insert_rowid();";
                    long lastId = Convert.ToInt64(idCmd.ExecuteScalar() ?? 0);

                    return (rows, lastId, null);
                }
                catch (Exception ex)
                {
                    return (0, 0, ex.Message);
                }
            }
        }

        public (List<Dictionary<string, object?>> rows, string? error) Query(string sql, List<object?>? parameters)
        {
            if (!IsSafeSqlStatement(sql))
            {
                return (new List<Dictionary<string, object?>>(), "SQL query blocked by security policy (Invalid verb or forbidden keyword)");
            }

            lock (_lock)
            {
                try
                {
                    using var conn = OpenConnection();

                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = sql;
                    BindParameters(cmd, parameters);

                    using var reader = cmd.ExecuteReader();
                    var list = new List<Dictionary<string, object?>>();

                    while (reader.Read())
                    {
                        var row = new Dictionary<string, object?>();
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            string colName = reader.GetName(i);
                            object val = reader.GetValue(i);
                            row[colName] = (val == DBNull.Value) ? null : val;
                        }
                        list.Add(row);
                    }

                    return (list, null);
                }
                catch (Exception ex)
                {
                    return (new List<Dictionary<string, object?>>(), ex.Message);
                }
            }
        }

        public (bool success, string? error) Batch(List<Dictionary<string, object>> statements)
        {
            lock (_lock)
            {
                SqliteConnection? conn = null;
                SqliteTransaction? trans = null;
                try
                {
                    conn = OpenConnection();
                    trans = conn.BeginTransaction();

                    foreach (var item in statements)
                    {
                        if (!item.TryGetValue("sql", out var sqlObj) || sqlObj is not string sql) continue;
                        if (!IsSafeSqlStatement(sql))
                        {
                            trans.Rollback();
                            return (false, $"SQL statement blocked by security policy in batch: {sql}");
                        }
                        using var cmd = conn.CreateCommand();
                        cmd.Transaction = trans;
                        cmd.CommandText = sql;

                        if (item.TryGetValue("params", out var pObj) && pObj is JsonElement je && je.ValueKind == JsonValueKind.Array)
                        {
                            var paramList = new List<object?>();
                            foreach (var elem in je.EnumerateArray())
                            {
                                paramList.Add(JsonElementToObject(elem));
                            }
                            BindParameters(cmd, paramList);
                        }

                        cmd.ExecuteNonQuery();
                    }

                    trans.Commit();
                    return (true, null);
                }
                catch (Exception ex)
                {
                    trans?.Rollback();
                    return (false, ex.Message);
                }
                finally
                {
                    trans?.Dispose();
                    conn?.Dispose();
                }
            }
        }

        private static void BindParameters(SqliteCommand cmd, List<object?>? parameters)
        {
            if (parameters == null || parameters.Count == 0) return;
            for (int i = 0; i < parameters.Count; i++)
            {
                var val = parameters[i];
                var param = cmd.CreateParameter();
                param.Value = val ?? DBNull.Value;
                cmd.Parameters.Add(param);
            }
        }

        public static object? JsonElementToObject(JsonElement element)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.String:
                    return element.GetString();
                case JsonValueKind.Number:
                    if (element.TryGetInt64(out long l)) return l;
                    if (element.TryGetDouble(out double d)) return d;
                    return element.GetRawText();
                case JsonValueKind.True:
                    return true;
                case JsonValueKind.False:
                    return false;
                case JsonValueKind.Null:
                    return null;
                default:
                    return element.GetRawText();
            }
        }
    }

    // ─── Native High-Performance Local Image Storage Manager ────────
    public class LocalImageManager
    {
        private static readonly Lazy<LocalImageManager> _instance = new(() => new LocalImageManager());
        public static LocalImageManager Shared => _instance.Value;

        public string ImagesDir => Path.Combine(SQLiteManager.Shared.DataDirectory, "images");

        public (string localPath, string url)? SaveImage(string fileName, string base64Data)
        {
            lock (SQLiteManager.Shared.SyncLock)
            {
                try
                {
                    Directory.CreateDirectory(ImagesDir);
                    string cleanBase64 = base64Data.Contains(",") ? base64Data.Split(',')[1] : base64Data;
                    byte[] bytes = Convert.FromBase64String(cleanBase64);

                    string sanitized = Regex.Replace(Path.GetFileName(fileName), @"[^a-zA-Z0-9_.-]", "_");
                    string finalName = string.IsNullOrWhiteSpace(sanitized)
                        ? $"img_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}_{Guid.NewGuid().ToString().Substring(0, 6)}.jpg"
                        : sanitized;

                    string filePath = Path.Combine(ImagesDir, finalName);
                    File.WriteAllBytes(filePath, bytes);

                    string relativePath = $"/local-images/{finalName}";
                    string fullUrl = $"http://127.0.0.1:41738{relativePath}";
                    return (relativePath, fullUrl);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[LocalImageManager] Save image error: {ex.Message}");
                    return null;
                }
            }
        }

        public byte[]? GetImageData(string fileName)
        {
            lock (SQLiteManager.Shared.SyncLock)
            {
                try
                {
                    string sanitized = Path.GetFileName(fileName);
                    string filePath = Path.Combine(ImagesDir, sanitized);
                    return File.Exists(filePath) ? File.ReadAllBytes(filePath) : null;
                }
                catch
                {
                    return null;
                }
            }
        }

        public bool DeleteImage(string fileName)
        {
            lock (SQLiteManager.Shared.SyncLock)
            {
                try
                {
                    string sanitized = Path.GetFileName(fileName);
                    string filePath = Path.Combine(ImagesDir, sanitized);
                    if (File.Exists(filePath))
                    {
                        File.Delete(filePath);
                        return true;
                    }
                }
                catch {}
                return false;
            }
        }

        public Dictionary<string, object> GetStats()
        {
            lock (SQLiteManager.Shared.SyncLock)
            {
                long totalBytes = 0;
                int count = 0;
                try
                {
                    var dirInfo = new DirectoryInfo(ImagesDir);
                    var files = dirInfo.GetFiles();
                    count = files.Length;
                    foreach (var file in files)
                    {
                        totalBytes += file.Length;
                    }
                }
                catch {}

                return new Dictionary<string, object>
                {
                    { "directory", ImagesDir },
                    { "count", count },
                    { "totalBytes", totalBytes },
                    { "totalMB", (totalBytes / (1024.0 * 1024.0)).ToString("F2") }
                };
            }
        }

        public void OpenFolderInExplorer()
        {
            try
            {
                Directory.CreateDirectory(ImagesDir);
                Process.Start(new ProcessStartInfo
                {
                    FileName = ImagesDir,
                    UseShellExecute = true,
                    Verb = "open"
                });
            }
            catch {}
        }
    }

    // ─── OTA Auto-Update Manager (Windows Over-The-Air via VPS) ───────
    public class OTAUpdateManager
    {
        private static readonly Lazy<OTAUpdateManager> _instance = new(() => new OTAUpdateManager());
        public static OTAUpdateManager Shared => _instance.Value;

        private readonly string _appDataDir;
        private readonly string _liveWebDir;
        private readonly string _versionFile;
        private int _isCheckingForUpdates;
        public string VpsApiOrigin { get; set; } = "https://dunvex.com";

        public OTAUpdateManager()
        {
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            _appDataDir = Path.Combine(appData, "Dunvex");
            _liveWebDir = Path.Combine(_appDataDir, "web");
            _versionFile = Path.Combine(_appDataDir, "ota_version_windows.json");
            Directory.CreateDirectory(_appDataDir);
        }

        public string GetEffectiveDistPath()
        {
            string liveIndex = Path.Combine(_liveWebDir, "index.html");
            if (File.Exists(liveIndex))
            {
                return _liveWebDir;
            }

            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string distPath = Path.Combine(exeDir, "dist");
            if (Directory.Exists(distPath)) return distPath;

            string projectDist = Path.GetFullPath(Path.Combine(exeDir, "..", "..", "..", "dist"));
            if (Directory.Exists(projectDist)) return projectDist;

            return exeDir;
        }

        public int GetLocalBuildNumber()
        {
            try
            {
                if (File.Exists(_versionFile))
                {
                    string jsonStr = File.ReadAllText(_versionFile);
                    using var doc = JsonDocument.Parse(jsonStr);
                    if (doc.RootElement.TryGetProperty("buildNumber", out var el) && el.TryGetInt32(out int bNum))
                    {
                        return bNum;
                    }
                }
            }
            catch {}

            if (File.Exists(Path.Combine(_liveWebDir, "index.html")))
            {
                return 101;
            }

            try
            {
                string bundledInfo = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dist", "release-info.json");
                if (File.Exists(bundledInfo))
                {
                    using var doc = JsonDocument.Parse(File.ReadAllText(bundledInfo));
                    if (doc.RootElement.TryGetProperty("buildNumber", out var build) && build.TryGetInt32(out int value))
                    {
                        return value;
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[OTA Windows] Bundled release metadata invalid: {ex.Message}");
            }
            return 101;
        }

        public async Task CheckForUpdatesAsync(WebView2? webView, bool silent = true)
        {
            if (Interlocked.Exchange(ref _isCheckingForUpdates, 1) != 0) return;

            try
            {
                using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
                string versionUrl = $"{VpsApiOrigin}/api/releases/windows/version";
                var response = await httpClient.GetAsync(versionUrl);
                if (!response.IsSuccessStatusCode)
                {
                    if (!silent)
                    {
                        MessageBox.Show("Không thể kết nối máy chủ VPS để kiểm tra bản cập nhật.", "Kiểm tra cập nhật", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }
                    return;
                }

                string jsonStr = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(jsonStr);
                var root = doc.RootElement;

                int serverBuild = root.TryGetProperty("buildNumber", out var bEl) && bEl.TryGetInt32(out int sBuild) ? sBuild : 101;
                string serverVersion = root.TryGetProperty("version", out var vEl) ? vEl.GetString() ?? "1.0.1" : "1.0.1";
                string releaseNotes = root.TryGetProperty("releaseNotes", out var rEl) ? rEl.GetString() ?? "Bản cập nhật mới" : "Bản cập nhật mới";
                string bundleUrl = root.TryGetProperty("bundleUrl", out var uEl) ? uEl.GetString() ?? "/api/releases/windows/bundle.zip" : "/api/releases/windows/bundle.zip";

                int localBuild = GetLocalBuildNumber();
                if (serverBuild > localBuild)
                {
                    if (!silent)
                    {
                        var choice = MessageBox.Show(
                            $"Đã có bản cập nhật Dunvex Windows v{serverVersion} (Build {serverBuild}).\n" +
                            $"{releaseNotes}\n\nBạn có muốn tải và cài đặt ngay không?",
                            "Có bản cập nhật mới",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Information);
                        if (choice != DialogResult.Yes) return;
                    }

                    Debug.WriteLine($"[OTA Windows] Updating to Build {serverBuild}...");
                    await DownloadAndApplyBundleAsync(bundleUrl, serverBuild, serverVersion, releaseNotes, webView, silent);
                }
                else
                {
                    if (!silent)
                    {
                        MessageBox.Show($"Bạn đang sử dụng phiên bản mới nhất (v{serverVersion} - Build {localBuild}).", "Dunvex POS", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[OTA Windows] Check error: {ex.Message}");
                if (!silent)
                {
                    MessageBox.Show($"Không thể kiểm tra cập nhật: {ex.Message}", "Lỗi kiểm tra", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
            finally
            {
                Interlocked.Exchange(ref _isCheckingForUpdates, 0);
            }
        }

        private async Task DownloadAndApplyBundleAsync(string bundleUrl, int serverBuild, string serverVersion, string releaseNotes, WebView2? webView, bool silent)
        {
            try
            {
                string fullUrl = bundleUrl.StartsWith("http") ? bundleUrl : $"{VpsApiOrigin}{bundleUrl}";
                using var httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(2) };
                byte[] zipBytes = await httpClient.GetByteArrayAsync(fullUrl);

                string tempZip = Path.Combine(_appDataDir, $"temp_bundle_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}.zip");
                File.WriteAllBytes(tempZip, zipBytes);

                string tmpExtractDir = Path.Combine(_appDataDir, $"web_tmp_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}");
                if (Directory.Exists(tmpExtractDir)) Directory.Delete(tmpExtractDir, true);
                Directory.CreateDirectory(tmpExtractDir);

                ZipFile.ExtractToDirectory(tempZip, tmpExtractDir);
                File.Delete(tempZip);

                string indexHtml = Path.Combine(tmpExtractDir, "index.html");
                if (File.Exists(indexHtml))
                {
                    string oldBackup = Path.Combine(_appDataDir, "web_old");
                    if (Directory.Exists(oldBackup)) Directory.Delete(oldBackup, true);

                    if (Directory.Exists(_liveWebDir))
                    {
                        Directory.Move(_liveWebDir, oldBackup);
                    }

                    Directory.Move(tmpExtractDir, _liveWebDir);
                    if (Directory.Exists(oldBackup)) Directory.Delete(oldBackup, true);

                    var meta = new Dictionary<string, object>
                    {
                        { "version", serverVersion },
                        { "buildNumber", serverBuild },
                        { "updatedAt", DateTimeOffset.UtcNow.ToUnixTimeSeconds() },
                        { "releaseNotes", releaseNotes }
                    };
                    File.WriteAllText(_versionFile, JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));

                    Debug.WriteLine($"[OTA Windows] Update complete! Version v{serverVersion} Build {serverBuild}");

                    if (webView?.CoreWebView2 != null)
                    {
                        string escapedNotes = releaseNotes.Replace("'", "\\'");
                        string js = $@"
                        window.dispatchEvent(new CustomEvent('app_updated_ready', {{
                            detail: {{
                                version: '{serverVersion}',
                                buildNumber: {serverBuild},
                                releaseNotes: '{escapedNotes}'
                            }}
                        }}));
                        ";
                        webView.Invoke((MethodInvoker)(() => webView.CoreWebView2.ExecuteScriptAsync(js)));
                    }

                    if (!silent)
                    {
                        var res = MessageBox.Show(
                            $"Đã cập nhật thành công lên phiên bản v{serverVersion} (Build {serverBuild})!\nNội dung: {releaseNotes}\n\nBạn có muốn làm mới trang ngay bây giờ?",
                            "Cập nhật hoàn tất",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Information
                        );
                        if (res == DialogResult.Yes && webView?.CoreWebView2 != null)
                        {
                            webView.Invoke((MethodInvoker)(() => webView.CoreWebView2.Reload()));
                        }
                    }
                }
                else
                {
                    if (Directory.Exists(tmpExtractDir)) Directory.Delete(tmpExtractDir, true);
                    Debug.WriteLine("[OTA Windows] Validation failed: index.html not found");
                    if (!silent)
                    {
                        MessageBox.Show(
                            "Gói cập nhật tải về không hợp lệ; ứng dụng chưa được cập nhật.",
                            "Lỗi cập nhật",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error);
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[OTA Windows] Download/Extract failed: {ex.Message}");
                if (!silent)
                {
                    MessageBox.Show(
                        $"Không thể tải hoặc áp dụng bản cập nhật: {ex.Message}",
                        "Lỗi cập nhật",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                }
            }
        }
    }

    // ─── Embedded High-Performance Local HTTP Server (Windows) ───────
    public class LocalEmbeddedServer
    {
        private HttpListener? _listener;
        private string DistPath => OTAUpdateManager.Shared.GetEffectiveDistPath();
        public int Port { get; private set; } = 41738;
        public LocalEmbeddedServer()
        {
        }

        public async Task<bool> StartAsync()
        {
            return await Task.Run(() =>
            {
                int basePort = 41738;
                for (int i = 0; i < 20; i++)
                {
                    HttpListener listener = new();
                    try
                    {
                        Port = basePort + i;
                        listener.Prefixes.Add($"http://127.0.0.1:{Port}/");
                        listener.Prefixes.Add($"http://localhost:{Port}/");
                        listener.Start();
                        _listener = listener;
                        _ = Task.Run(() => AcceptRequests(listener));
                        return true;
                    }
                    catch (Exception ex)
                    {
                        listener.Close();
                        if (i == 19)
                        {
                            Debug.WriteLine($"[LocalServer] Failed to bind any port: {ex.Message}");
                            return false;
                        }
                    }
                }

                return false;
            });
        }

        private void AcceptRequests(HttpListener listener)
        {
            while (listener.IsListening)
            {
                try
                {
                    var context = listener.GetContext();
                    Task.Run(() => HandleRequest(context));
                }
                catch
                {
                    break;
                }
            }
        }

        private void HandleRequest(HttpListenerContext context)
        {
            try
            {
                var request = context.Request;
                var response = context.Response;

                string rawPath = request.Url?.AbsolutePath ?? "/";
                string decodedPath = WebUtility.UrlDecode(rawPath);

                // 1. Local Images Route (/local-images/...)
                if (decodedPath.StartsWith("/local-images/"))
                {
                    string imgFileName = decodedPath.Substring("/local-images/".Length);
                    byte[]? imgBytes = LocalImageManager.Shared.GetImageData(imgFileName);
                    if (imgBytes != null)
                    {
                        response.ContentType = GetMimeType(imgFileName);
                        response.ContentLength64 = imgBytes.Length;
                        response.AddHeader("Cache-Control", "public, max-age=86400");
                        response.OutputStream.Write(imgBytes, 0, imgBytes.Length);
                        response.OutputStream.Close();
                        return;
                    }

                    response.StatusCode = 404;
                    response.Close();
                    return;
                }

                // 2. Production Web Bundle (dist/...)
                string canonicalDist = Path.GetFullPath(DistPath);
                string relative = decodedPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                if (string.IsNullOrEmpty(relative)) relative = "index.html";

                string candidate = Path.GetFullPath(Path.Combine(canonicalDist, relative));

                if (!candidate.StartsWith(canonicalDist, StringComparison.OrdinalIgnoreCase))
                {
                    response.StatusCode = 403;
                    response.Close();
                    return;
                }

                // SPA Fallback: if file doesn't exist and has no extension, serve index.html
                if (!File.Exists(candidate) && !relative.Contains('.'))
                {
                    candidate = Path.Combine(canonicalDist, "index.html");
                }

                if (File.Exists(candidate))
                {
                    byte[] fileBytes = File.ReadAllBytes(candidate);
                    response.ContentType = GetMimeType(candidate);
                    response.ContentLength64 = fileBytes.Length;
                    response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate");
                    response.OutputStream.Write(fileBytes, 0, fileBytes.Length);
                    response.OutputStream.Close();
                }
                else
                {
                    response.StatusCode = 404;
                    response.Close();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[LocalServer] HandleRequest Exception: {ex.Message}");
            }
        }

        private static string GetMimeType(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            return ext switch
            {
                ".html" or ".htm" => "text/html; charset=utf-8",
                ".js" or ".mjs" => "application/javascript; charset=utf-8",
                ".css" => "text/css; charset=utf-8",
                ".json" => "application/json; charset=utf-8",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".svg" => "image/svg+xml",
                ".ico" => "image/x-icon",
                ".webp" => "image/webp",
                ".webmanifest" => "application/manifest+json",
                ".woff2" => "font/woff2",
                ".woff" => "font/woff",
                ".ttf" => "font/ttf",
                _ => "application/octet-stream",
            };
        }
    }

    // ─── Main Application Window (Windows Forms + WebView2) ──────────
    public class MainForm : Form
    {
        private const uint ClipboardDibFormat = 8;
        private const uint GlobalMoveable = 0x0002;
        private static readonly object ClipboardDiagnosticLogLock = new();
        private readonly WebView2 _webView;
        private LocalEmbeddedServer? _localServer;
        private readonly MenuStrip _mainMenu;
        private static string ClipboardDiagnosticLogPath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Dunvex",
            "logs",
            "windows-clipboard.log");

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool OpenClipboard(IntPtr newOwner);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool EmptyClipboard();

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SetClipboardData(uint format, IntPtr memory);

        [DllImport("user32.dll")]
        private static extern bool CloseClipboard();

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr GlobalAlloc(uint flags, UIntPtr bytes);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr GlobalLock(IntPtr memory);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GlobalUnlock(IntPtr memory);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr GlobalFree(IntPtr memory);

        public MainForm()
        {
            Text = "Dunvex POS & Production";
            Width = 1400;
            Height = 880;
            MinimumSize = new Size(960, 600);
            StartPosition = FormStartPosition.CenterScreen;
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application;

            _mainMenu = CreateMenu();
            MainMenuStrip = _mainMenu;
            Controls.Add(_mainMenu);

            _webView = new WebView2
            {
                Dock = DockStyle.Fill
            };
            Controls.Add(_webView);

            InitApp();
        }

        private MenuStrip CreateMenu()
        {
            var menu = new MenuStrip
            {
                BackColor = Color.FromArgb(245, 247, 250),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular)
            };

            // App Menu
            var appItem = new ToolStripMenuItem("Hệ thống");
            appItem.DropDownItems.Add("Về Dunvex Build (v1.0.1)", null, (s, e) => ShowAbout());
            appItem.DropDownItems.Add("Mở vị trí dữ liệu SQLite (Explorer)...", null, (s, e) => OpenDatabaseFolder());
            appItem.DropDownItems.Add("Mở thư mục ảnh cục bộ (Explorer)...", null, (s, e) => LocalImageManager.Shared.OpenFolderInExplorer());
            appItem.DropDownItems.Add("Kiểm tra cập nhật phiên bản...", null, async (s, e) => await OTAUpdateManager.Shared.CheckForUpdatesAsync(_webView, silent: false));
            appItem.DropDownItems.Add("Kiểm tra clipboard Windows...", null, (s, e) => RunClipboardDiagnostic());
            appItem.DropDownItems.Add("Mở log clipboard...", null, (s, e) => OpenClipboardDiagnosticLog());
            appItem.DropDownItems.Add(new ToolStripSeparator());
            appItem.DropDownItems.Add("Đồng bộ dữ liệu với máy chủ (Full Sync)", null, (s, e) => TriggerFullSync());
            appItem.DropDownItems.Add("Làm mới trang (F5)", null, (s, e) => ReloadPage());
            appItem.DropDownItems.Add(new ToolStripSeparator());
            appItem.DropDownItems.Add("Thoát (Alt+F4)", null, (s, e) => Close());

            // View Menu
            var viewItem = new ToolStripMenuItem("Xem");
            viewItem.DropDownItems.Add("Toàn màn hình (F11)", null, (s, e) => ToggleFullScreen());

            menu.Items.Add(appItem);
            menu.Items.Add(viewItem);
            return menu;
        }

        private async void InitApp()
        {
            try
            {
                string version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            }
            catch (Exception)
            {
                var res = MessageBox.Show(
                    "Ứng dụng Dunvex yêu cầu Microsoft Edge WebView2 Runtime để hoạt động trên Windows.\n\nBạn có muốn mở trang tải WebView2 Runtime chính thức từ Microsoft ngay bây giờ không?",
                    "Cần cài đặt Microsoft WebView2 Runtime",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information
                );
                if (res == DialogResult.Yes)
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = "https://go.microsoft.com/fwlink/p/?LinkId=2124703",
                            UseShellExecute = true
                        });
                    }
                    catch { }
                }
                Close();
                return;
            }

            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string userDataFolder = Path.Combine(appData, "Dunvex", "WebView2Data");

            try
            {
                _localServer = new LocalEmbeddedServer();
                if (!await _localServer.StartAsync())
                {
                    MessageBox.Show(
                        "Không thể khởi động máy chủ giao diện cục bộ. Hãy đóng ứng dụng Dunvex đang chạy khác rồi thử lại.",
                        "Lỗi khởi động Dunvex",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    Close();
                    return;
                }

                var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await _webView.EnsureCoreWebView2Async(env);
                await _webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("""
                    (() => {
                        const minimumSwipeDistance = 110;
                        let touchStart = null;
                        let wheelDistance = 0;
                        let wheelStartedAt = 0;
                        let wheelTimer = 0;

                        const isInteractive = (target) =>
                            target instanceof Element &&
                            target.closest('input, textarea, select, button, a, [role="button"], [contenteditable="true"]') !== null;

                        const canScrollHorizontallyLeft = (target) => {
                            for (let element = target instanceof Element ? target : null; element; element = element.parentElement) {
                                const style = getComputedStyle(element);
                                if (!/(auto|scroll)/.test(style.overflowX)) continue;
                                if (element.scrollLeft > 0) return true;
                            }
                            return false;
                        };

                        document.addEventListener('pointerdown', (event) => {
                            touchStart = event.pointerType === 'touch' &&
                                event.isPrimary &&
                                event.clientX <= 28 &&
                                !isInteractive(event.target)
                                ? { x: event.clientX, y: event.clientY }
                                : null;
                        }, true);

                        document.addEventListener('pointerup', (event) => {
                            if (!touchStart) return;
                            const deltaX = event.clientX - touchStart.x;
                            const deltaY = Math.abs(event.clientY - touchStart.y);
                            touchStart = null;
                            if (deltaX >= minimumSwipeDistance && deltaY < 75) history.back();
                        }, true);

                        document.addEventListener('pointercancel', () => { touchStart = null; }, true);

                        document.addEventListener('wheel', (event) => {
                            if (event.deltaX >= 0 || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.5 ||
                                isInteractive(event.target) || canScrollHorizontallyLeft(event.target)) {
                                wheelDistance = 0;
                                return;
                            }

                            const now = performance.now();
                            if (now - wheelStartedAt > 500) wheelDistance = 0;
                            wheelStartedAt = now;
                            wheelDistance += Math.abs(event.deltaX);
                            clearTimeout(wheelTimer);
                            wheelTimer = window.setTimeout(() => { wheelDistance = 0; }, 500);

                            if (wheelDistance >= 180) {
                                wheelDistance = 0;
                                history.back();
                            }
                        }, { passive: true, capture: true });
                    })();
                    """);

                _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
#if DEBUG
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
#else
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
#endif
                _webView.CoreWebView2.Settings.IsZoomControlEnabled = true;

                _webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
                _webView.CoreWebView2.DownloadStarting += (_, e) =>
                {
                    string suggestedName = Path.GetFileName(e.ResultFilePath);
                    if (string.IsNullOrWhiteSpace(suggestedName))
                    {
                        suggestedName = "download";
                    }
                    bool isExcel = string.Equals(Path.GetExtension(suggestedName), ".xlsx", StringComparison.OrdinalIgnoreCase);
                    using var saveDialog = new SaveFileDialog
                    {
                        FileName = suggestedName,
                        Filter = isExcel ? "Excel workbook (*.xlsx)|*.xlsx|All files (*.*)|*.*" : "All files (*.*)|*.*",
                        AddExtension = isExcel,
                        DefaultExt = isExcel ? "xlsx" : string.Empty,
                        OverwritePrompt = true,
                        RestoreDirectory = true,
                        Title = "Lưu tệp đã tải xuống"
                    };

                    if (saveDialog.ShowDialog(this) == DialogResult.OK)
                    {
                        e.ResultFilePath = saveDialog.FileName;
                        e.Handled = true;
                    }
                    else
                    {
                        e.Cancel = true;
                        e.Handled = true;
                    }
                };

                _webView.CoreWebView2.Navigate($"http://127.0.0.1:{_localServer.Port}/");

                // Check for OTA Updates in background after 3 seconds
                Task.Delay(3000).ContinueWith(_ => OTAUpdateManager.Shared.CheckForUpdatesAsync(_webView, silent: true));
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Lỗi khởi tạo WebView2: {ex.Message}", "Lỗi khởi động", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private bool IsAllowedOrigin(string? sourceUrl)
        {
            if (string.IsNullOrEmpty(sourceUrl)) return false;
            if (!Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri)) return false;

            int localPort = _localServer?.Port ?? 41738;
            bool isAllowed = uri.Scheme == "http" &&
                (uri.Host == "127.0.0.1" || uri.Host == "localhost") &&
                uri.Port == localPort;

            return isAllowed;
        }

        private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            if (!IsAllowedOrigin(e.Source))
            {
                Debug.WriteLine($"[Security] Blocked WebMessage from unauthorized origin: {e.Source}");
                return;
            }

            try
            {
                string rawJson = e.WebMessageAsJson;
                using var doc = JsonDocument.Parse(rawJson);
                var root = doc.RootElement.Clone();

                string bridge = root.TryGetProperty("bridge", out var bElem) ? bElem.GetString() ?? "" : "";
                string requestId = root.TryGetProperty("requestId", out var rElem) ? rElem.GetString() ?? "" : "";
                string action = root.TryGetProperty("action", out var aElem) ? aElem.GetString() ?? "" : "";

                if (bridge == "sqliteBridge" || root.TryGetProperty("sql", out _))
                {
                    HandleSqliteMessage(root, requestId, action);
                }
                else if (bridge == "fileBridge")
                {
                    HandleFileMessage(root, requestId, action);
                }
                else if (bridge == "biometricBridge")
                {
                    HandleBiometricMessage(root, requestId, action);
                }
                else if (action == "checkForUpdates")
                {
                    _ = OTAUpdateManager.Shared.CheckForUpdatesAsync(_webView, silent: false);
                }
                else if (action == "print" || root.TryGetProperty("isReceipt", out _))
                {
                    HandlePrintMessage(root);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Bridge] Message error: {ex.Message}");
            }
        }

        private void HandleSqliteMessage(JsonElement root, string requestId, string action)
        {
            string normalizedAction = action.Trim().Replace("_", "").Replace("-", "");
            if (string.Equals(normalizedAction, "chooseStorageLocation", StringComparison.OrdinalIgnoreCase))
            {
                BeginInvoke(new Action(async () =>
                {
                    using var dialog = new FolderBrowserDialog
                    {
                        Description = "Chọn ổ đĩa hoặc thư mục chứa dữ liệu Dunvex",
                        UseDescriptionForTitle = true,
                        ShowNewFolderButton = true
                    };
                    if (dialog.ShowDialog(this) != DialogResult.OK)
                    {
                        SendJsCallback("__sqliteBridgeCallback", requestId, new { cancelled = true }, null);
                        return;
                    }
                    string targetDirectory = Path.Combine(dialog.SelectedPath, "DunvexData");
                    if (MessageBox.Show(
                        this,
                        $"SQLite và ảnh offline sẽ được chuyển sang:\n{targetDirectory}\n\nỔ đĩa cần luôn được kết nối. Tiếp tục?",
                        "Xác nhận chuyển dữ liệu",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Question) != DialogResult.Yes)
                    {
                        SendJsCallback("__sqliteBridgeCallback", requestId, new { cancelled = true }, null);
                        return;
                    }

                    try
                    {
                        string dbPath = await Task.Run(() =>
                            SQLiteManager.Shared.ChangeStorageLocation(dialog.SelectedPath));
                        SendJsCallback("__sqliteBridgeCallback", requestId, new { cancelled = false, dbPath }, null);
                    }
                    catch (Exception ex)
                    {
                        SendJsCallback("__sqliteBridgeCallback", requestId, null, ex.Message);
                    }
                }));
                return;
            }

            Task.Run(() =>
            {
                object? result = null;
                string? error = null;

                try
                {
                    switch (normalizedAction.ToLowerInvariant())
                    {
                        case "ping":
                            result = new
                            {
                                status = "ok",
                                dbPath = SQLiteManager.Shared.DbPath,
                                supportsStorageLocationSelection = true
                            };
                            break;
                        case "execute":
                            string sql = root.GetProperty("sql").GetString() ?? "";
                            var pList = ExtractParams(root);
                            var execRes = SQLiteManager.Shared.Execute(sql, pList);
                            if (execRes.error != null) error = execRes.error;
                            else result = new { rowsAffected = execRes.rowsAffected, lastInsertId = execRes.lastInsertId };
                            break;
                        case "query":
                            string qSql = root.GetProperty("sql").GetString() ?? "";
                            var qParams = ExtractParams(root);
                            var queryRes = SQLiteManager.Shared.Query(qSql, qParams);
                            if (queryRes.error != null) error = queryRes.error;
                            else result = queryRes.rows;
                            break;
                        case "batch":
                            if (root.TryGetProperty("statements", out var stmtElem) && stmtElem.ValueKind == JsonValueKind.Array)
                            {
                                var list = new List<Dictionary<string, object>>();
                                foreach (var item in stmtElem.EnumerateArray())
                                {
                                    var d = new Dictionary<string, object>();
                                    if (item.TryGetProperty("sql", out var s)) d["sql"] = s.GetString() ?? "";
                                    if (item.TryGetProperty("params", out var p)) d["params"] = p;
                                    list.Add(d);
                                }
                                var batchRes = SQLiteManager.Shared.Batch(list);
                                if (batchRes.error != null) error = batchRes.error;
                                else result = new { success = true };
                            }
                            break;
                    }
                }
                catch (Exception ex)
                {
                    error = ex.Message;
                }

                SendJsCallback("__sqliteBridgeCallback", requestId, result, error);
            });
        }

        private void HandleFileMessage(JsonElement root, string requestId, string action)
        {
            Task.Run(() =>
            {
                object? result = null;
                string? error = null;

                try
                {
                    switch (action)
                    {
                        case "ping":
                        case "getStats":
                            result = LocalImageManager.Shared.GetStats();
                            break;
                        case "saveImage":
                            string fileName = root.TryGetProperty("fileName", out var fn) ? fn.GetString() ?? "" : "";
                            string base64 = root.TryGetProperty("base64", out var b64) ? b64.GetString() ?? "" : "";
                            var saved = LocalImageManager.Shared.SaveImage(fileName, base64);
                            if (saved.HasValue)
                            {
                                result = new { success = true, localPath = saved.Value.localPath, url = saved.Value.url };
                            }
                            else
                            {
                                error = "Failed to save local image on Windows disk";
                            }
                            break;
                        case "getImage":
                            string getFn = root.TryGetProperty("fileName", out var gfn) ? gfn.GetString() ?? "" : "";
                            byte[]? bytes = LocalImageManager.Shared.GetImageData(getFn);
                            if (bytes != null)
                            {
                                result = new { success = true, base64 = Convert.ToBase64String(bytes) };
                            }
                            else
                            {
                                error = "Image not found";
                            }
                            break;
                        case "deleteImage":
                            string delFn = root.TryGetProperty("fileName", out var dfn) ? dfn.GetString() ?? "" : "";
                            bool deleted = LocalImageManager.Shared.DeleteImage(delFn);
                            result = new { success = deleted };
                            break;
                        case "copyImage":
                            HandleCopyImage(root, requestId, out result, out error);
                            break;
                        case "openFolder":
                            LocalImageManager.Shared.OpenFolderInExplorer();
                            result = new { success = true };
                            break;
                    }
                }
                catch (Exception ex)
                {
                    error = ex.Message;
                    Debug.WriteLine($"[FileBridge] {action} failed: {ex}");
                    if (action == "copyImage")
                    {
                        LogClipboardDiagnostic("handler.exception", $"{ex.GetType().Name}: {ex.Message}");
                    }
                }

                try
                {
                    if (action == "copyImage")
                    {
                        LogClipboardDiagnostic("callback.dispatch", error ?? "success");
                    }
                    SendJsCallback("__fileBridgeCallback", requestId, result, error);
                    if (action == "copyImage")
                    {
                        LogClipboardDiagnostic("callback.dispatched");
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[FileBridge] Callback failed for {action}: {ex}");
                    if (action == "copyImage")
                    {
                        LogClipboardDiagnostic("callback.failed", $"{ex.GetType().Name}: {ex.Message}");
                    }
                }
            });
        }

        private void HandleCopyImage(JsonElement root, string requestId, out object? result, out string? error)
        {
            result = null;
            error = null;
            string imgB64 = root.TryGetProperty("base64", out var bProp) ? bProp.GetString() ?? "" : "";
            LogClipboardDiagnostic("request.received", $"request={requestId}; base64Chars={imgB64.Length}");
            if (string.IsNullOrEmpty(imgB64))
            {
                error = "Không có dữ liệu ảnh";
                LogClipboardDiagnostic("request.invalid", error);
                return;
            }

            try
            {
                string rawB64 = imgB64.Contains(",") ? imgB64.Substring(imgB64.IndexOf(",") + 1) : imgB64;
                byte[] imgBytes = Convert.FromBase64String(rawB64);
                LogClipboardDiagnostic("image.decoded", $"bytes={imgBytes.Length}");
                using var ms = new MemoryStream(imgBytes);
                using var imageObj = Image.FromStream(ms);
                LogClipboardDiagnostic("image.loaded", $"width={imageObj.Width}; height={imageObj.Height}");
                using var bitmap = new Bitmap(imageObj);
                CopyBitmapToWindowsClipboard(bitmap);
                LogClipboardDiagnostic("clipboard.written");
                result = new { success = true };
            }
            catch (Exception ex)
            {
                error = $"Lỗi ghi ảnh vào clipboard Windows: {ex.Message}";
                LogClipboardDiagnostic("copy.failed", $"{ex.GetType().Name}: {ex.Message}");
            }
        }

        private void CopyBitmapToWindowsClipboard(Bitmap bitmap)
        {
            void SetImage()
            {
                if (Thread.CurrentThread.GetApartmentState() != ApartmentState.STA)
                {
                    throw new InvalidOperationException("Windows Clipboard.SetImage phải chạy trên luồng STA.");
                }

                Clipboard.SetImage(bitmap);
                if (!Clipboard.ContainsImage())
                {
                    throw new InvalidOperationException("Windows không đọc lại được ảnh vừa ghi vào clipboard.");
                }
            }

            if (InvokeRequired)
            {
                Invoke((Action)SetImage);
            }
            else
            {
                SetImage();
            }
        }

        private static byte[] EncodeImageAsDib(Image image)
        {
            using var bitmap = new Bitmap(image.Width, image.Height, System.Drawing.Imaging.PixelFormat.Format24bppRgb);
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.Clear(Color.White);
                graphics.DrawImage(image, 0, 0, image.Width, image.Height);
            }

            using var bitmapStream = new MemoryStream();
            bitmap.Save(bitmapStream, System.Drawing.Imaging.ImageFormat.Bmp);
            byte[] bitmapFile = bitmapStream.ToArray();
            if (bitmapFile.Length <= 14)
            {
                throw new InvalidDataException("Dữ liệu ảnh BMP không hợp lệ.");
            }

            var dib = new byte[bitmapFile.Length - 14];
            Buffer.BlockCopy(bitmapFile, 14, dib, 0, dib.Length);
            return dib;
        }

        private void RunClipboardDiagnostic()
        {
            var confirm = MessageBox.Show(
                this,
                "Bài kiểm tra sẽ thay nội dung clipboard hiện tại bằng một ảnh thử nhỏ.\n" +
                "Tiếp tục kiểm tra?",
                "Kiểm tra clipboard Windows",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning);
            if (confirm != DialogResult.Yes) return;

            try
            {
                LogClipboardDiagnostic("test.started");
                using var testImage = new Bitmap(16, 16, System.Drawing.Imaging.PixelFormat.Format24bppRgb);
                using (var graphics = Graphics.FromImage(testImage))
                {
                    graphics.Clear(Color.FromArgb(26, 35, 126));
                }

                byte[] dib = EncodeImageAsDib(testImage);
                WriteDibToClipboard(dib, Handle);
                LogClipboardDiagnostic("test.clipboard.written", $"dibBytes={dib.Length}");
                if (!Clipboard.ContainsImage())
                {
                    throw new InvalidOperationException("Windows không đọc lại được ảnh vừa ghi vào clipboard.");
                }

                LogClipboardDiagnostic("test.passed");
                MessageBox.Show(
                    this,
                    $"Clipboard Windows hoạt động bình thường.\nĐã ghi và đọc lại ảnh thử.\n\nLog: {ClipboardDiagnosticLogPath}",
                    "Kiểm tra thành công",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                LogClipboardDiagnostic("test.failed", $"{ex.GetType().Name}: {ex.Message}");
                MessageBox.Show(
                    this,
                    $"Kiểm tra clipboard thất bại:\n{ex.Message}\n\nLog: {ClipboardDiagnosticLogPath}",
                    "Lỗi clipboard",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }

        private void OpenClipboardDiagnosticLog()
        {
            if (!File.Exists(ClipboardDiagnosticLogPath))
            {
                MessageBox.Show(
                    this,
                    "Chưa có log clipboard. Hãy thử sao chép ảnh hoặc chạy kiểm tra clipboard trước.",
                    "Log clipboard",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            Process.Start(new ProcessStartInfo("notepad.exe", $"\"{ClipboardDiagnosticLogPath}\"")
            {
                UseShellExecute = true
            });
        }

        private static void LogClipboardDiagnostic(string stage, string details = "")
        {
            string line = $"{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss.fff zzz}\t{stage}\t{details}{Environment.NewLine}";
            try
            {
                lock (ClipboardDiagnosticLogLock)
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(ClipboardDiagnosticLogPath)!);
                    File.AppendAllText(ClipboardDiagnosticLogPath, line);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[ClipboardDiagnostic] Could not write log: {ex.Message}");
            }
        }

        private void WriteDibToClipboard(byte[] dib, IntPtr clipboardOwner)
        {
            IntPtr globalMemory = GlobalAlloc(GlobalMoveable, (UIntPtr)dib.Length);
            if (globalMemory == IntPtr.Zero)
            {
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "Không cấp phát được bộ nhớ clipboard.");
            }

            try
            {
                IntPtr lockedMemory = GlobalLock(globalMemory);
                if (lockedMemory == IntPtr.Zero)
                {
                    throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "Không truy cập được bộ nhớ ảnh clipboard.");
                }

                Marshal.Copy(dib, 0, lockedMemory, dib.Length);
                GlobalUnlock(globalMemory);

                bool opened = false;
                for (int attempt = 0; attempt < 10 && !opened; attempt++)
                {
                    opened = OpenClipboard(clipboardOwner);
                    if (!opened) Thread.Sleep(50);
                }

                if (!opened)
                {
                    throw new ExternalException("Không thể mở clipboard Windows; một ứng dụng khác đang khóa clipboard.");
                }

                try
                {
                    if (!EmptyClipboard())
                    {
                        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "Không thể làm trống clipboard Windows.");
                    }

                    if (SetClipboardData(ClipboardDibFormat, globalMemory) == IntPtr.Zero)
                    {
                        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "Windows từ chối dữ liệu ảnh clipboard.");
                    }

                    globalMemory = IntPtr.Zero;
                }
                finally
                {
                    CloseClipboard();
                }
            }
            finally
            {
                if (globalMemory != IntPtr.Zero)
                {
                    GlobalFree(globalMemory);
                }
            }
        }

        private void HandleBiometricMessage(JsonElement root, string requestId, string action)
        {
            Task.Run(() =>
            {
                object? result = null;
                string? error = null;

                switch (action)
                {
                    case "isAvailable":
                        result = new
                        {
                            available = false,
                            hasTouchId = false,
                            biometryType = "none",
                            label = "Chưa hỗ trợ xác thực sinh trắc học trên Windows (Vui lòng dùng Mật khẩu)"
                        };
                        break;
                    case "authenticate":
                        error = "Xác thực sinh trắc học (Windows Hello) chưa được hỗ trợ trên phiên bản này. Vui lòng sử dụng Mật khẩu / Mã PIN.";
                        break;
                }

                SendJsCallback("__biometricBridgeCallback", requestId, result, error);
            });
        }

        private void HandlePrintMessage(JsonElement root)
        {
            Invoke(() =>
            {
                try
                {
                    _webView.CoreWebView2.ShowPrintUI(CoreWebView2PrintDialogKind.Browser);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[Print] Error: {ex.Message}");
                }
            });
        }

        private static List<object?>? ExtractParams(JsonElement root)
        {
            if (!root.TryGetProperty("params", out var pElem) || pElem.ValueKind != JsonValueKind.Array)
                return null;

            var list = new List<object?>();
            foreach (var elem in pElem.EnumerateArray())
            {
                list.Add(SQLiteManager.JsonElementToObject(elem));
            }
            return list;
        }

        private void SendJsCallback(string callbackName, string requestId, object? result, string? error)
        {
            if (string.IsNullOrEmpty(requestId)) return;
            if (IsDisposed || !IsHandleCreated)
            {
                throw new InvalidOperationException("Không thể gửi phản hồi: cửa sổ ứng dụng đã đóng.");
            }

            string js;
            if (error != null)
            {
                string escapedErr = JsonEncodedText.Encode(error).ToString();
                js = $"window.{callbackName} && window.{callbackName}('{requestId}', null, \"{escapedErr}\");";
            }
            else
            {
                string jsonResult = JsonSerializer.Serialize(result);
                js = $"window.{callbackName} && window.{callbackName}('{requestId}', {jsonResult}, null);";
            }

            BeginInvoke(new Action(async () =>
            {
                try
                {
                    var coreWebView = _webView.CoreWebView2
                        ?? throw new InvalidOperationException("WebView2 chưa sẵn sàng để nhận phản hồi.");
                    await coreWebView.ExecuteScriptAsync(js);
                    if (callbackName == "__fileBridgeCallback")
                    {
                        LogClipboardDiagnostic("callback.executed");
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[Bridge] Could not execute callback {callbackName}: {ex}");
                    if (callbackName == "__fileBridgeCallback")
                    {
                        LogClipboardDiagnostic("callback.script.failed", $"{ex.GetType().Name}: {ex.Message}");
                    }
                }
            }));
        }

        private void ShowAbout()
        {
            MessageBox.Show(
                $"Dunvex POS & Production\nPhiên bản: 1.0.1 (Build 101 for Windows)\nKiến trúc: Offline-First Native Windows (SQLite & Local Image Storage)\nĐường dẫn DB: {SQLiteManager.Shared.DbPath}\nBản quyền © 2026 Dunvex.",
                "Về Dunvex Build",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );
        }

        private void OpenDatabaseFolder()
        {
            try
            {
                string folder = Path.GetDirectoryName(SQLiteManager.Shared.DbPath) ?? "";
                Process.Start(new ProcessStartInfo
                {
                    FileName = folder,
                    UseShellExecute = true,
                    Verb = "open"
                });
            }
            catch {}
        }

        private void TriggerFullSync()
        {
            _webView.CoreWebView2?.ExecuteScriptAsync(@"
                window.dispatchEvent(new CustomEvent('dunvex_full_sync', { detail: { force: true } }));
                window.dispatchEvent(new CustomEvent('trigger_full_sync', { detail: { force: true } }));
            ");
        }

        private void ReloadPage()
        {
            _webView.CoreWebView2?.Reload();
        }

        private bool _isFullScreen = false;
        private FormBorderStyle _prevBorderStyle;
        private FormWindowState _prevWindowState;
        private Rectangle _prevBounds;

        private void ToggleFullScreen()
        {
            if (!_isFullScreen)
            {
                _prevBorderStyle = FormBorderStyle;
                _prevWindowState = WindowState;
                _prevBounds = Bounds;

                FormBorderStyle = FormBorderStyle.None;
                WindowState = FormWindowState.Maximized;
                _mainMenu.Visible = false;
                _isFullScreen = true;
            }
            else
            {
                FormBorderStyle = _prevBorderStyle;
                WindowState = _prevWindowState;
                Bounds = _prevBounds;
                _mainMenu.Visible = true;
                _isFullScreen = false;
            }
        }
    }

    // ─── Entry Point ─────────────────────────────────────────────────
    public static class Program
    {
        [STAThread]
        public static void Main()
        {
            Application.SetHighDpiMode(HighDpiMode.SystemAware);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
