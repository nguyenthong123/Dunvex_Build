import Cocoa
import WebKit
import Network
import SQLite3
import LocalAuthentication
import UniformTypeIdentifiers
import CryptoKit

// ─── Native High-Performance SQLite Manager (macOS Embedded) ─
class SQLiteManager {
    static let shared = SQLiteManager()
    private var db: OpaquePointer?
    private let queue = DispatchQueue(label: "com.dunvex.sqlite.queue", qos: .userInitiated)
    var dbPath: String = ""
    private(set) var dataDirectory: URL

    init() {
        if let selectedPath = UserDefaults.standard.string(forKey: "DunvexStorageDirectory") {
            dataDirectory = URL(fileURLWithPath: selectedPath, isDirectory: true)
        } else {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            dataDirectory = appSupport.appendingPathComponent("Dunvex", isDirectory: true)
        }
        openDB()
        initTables()
    }

    private func openDB() {
        if UserDefaults.standard.string(forKey: "DunvexStorageDirectory") != nil &&
            !FileManager.default.fileExists(atPath: dataDirectory.deletingLastPathComponent().path) {
            print("[SQLite] Selected storage volume is unavailable: \(dataDirectory.path)")
            return
        }
        try? FileManager.default.createDirectory(at: dataDirectory, withIntermediateDirectories: true, attributes: nil)
        let dbUrl = dataDirectory.appendingPathComponent("dunvex_local.sqlite")
        self.dbPath = dbUrl.path

        if sqlite3_open(dbUrl.path, &db) == SQLITE_OK {
            print("[SQLite] Local SQLite database ready at \(dbUrl.path)")
            sqlite3_exec(db, "PRAGMA journal_mode = WAL;", nil, nil, nil)
            sqlite3_exec(db, "PRAGMA synchronous = NORMAL;", nil, nil, nil)
            sqlite3_exec(db, "PRAGMA busy_timeout = 5000;", nil, nil, nil)
        } else {
            print("[SQLite] Failed to open database at \(dbUrl.path)")
        }
    }

    var isOpen: Bool {
        queue.sync { db != nil }
    }

    func currentDatabasePath() -> String {
        queue.sync { dbPath }
    }

    func storageInfo() -> (dbPath: String, isOpen: Bool) {
        queue.sync { (dbPath, db != nil) }
    }

    func withStorageLock<T>(_ operation: () -> T) -> T {
        queue.sync(execute: operation)
    }

    func changeStorageLocation(parentPath: String) -> (dbPath: String?, error: String?) {
        var resultPath: String?
        var resultError: String?
        queue.sync {
            let fileManager = FileManager.default
            let parent = URL(fileURLWithPath: parentPath, isDirectory: true).standardizedFileURL
            let targetDirectory = parent.appendingPathComponent("DunvexData", isDirectory: true)
            let oldDirectory = dataDirectory
            let oldDbPath = dbPath
            let stagingDirectory = parent.appendingPathComponent(".Dunvex-migration-\(UUID().uuidString)", isDirectory: true)
            let targetDbPath = targetDirectory.appendingPathComponent("dunvex_local.sqlite").path
            let settings = UserDefaults.standard
            let hadStoredLocation = settings.string(forKey: "DunvexStorageDirectory") != nil
            var destinationCreated = false

            guard fileManager.fileExists(atPath: parent.path) else {
                resultError = "Ổ đĩa hoặc thư mục đã chọn không còn tồn tại."
                return
            }
            if oldDirectory.standardizedFileURL.path == targetDirectory.standardizedFileURL.path {
                resultPath = dbPath
                return
            }
            if targetDirectory.path.hasPrefix(oldDirectory.path + "/") {
                resultError = "Không thể chọn thư mục con bên trong vị trí Dunvex hiện tại."
                return
            }
            if fileManager.fileExists(atPath: targetDirectory.path),
               ((try? fileManager.contentsOfDirectory(atPath: targetDirectory.path).isEmpty) == false) {
                resultError = "Thư mục đã chọn có sẵn dữ liệu Dunvex. Hãy chọn một thư mục khác để tránh ghi đè."
                return
            }
            guard let currentDb = db else {
                resultError = "SQLite hiện tại chưa mở được; không thể di chuyển dữ liệu."
                return
            }

            do {
                guard sqlite3_wal_checkpoint_v2(currentDb, nil, SQLITE_CHECKPOINT_TRUNCATE, nil, nil) == SQLITE_OK else {
                    throw NSError(domain: "DunvexStorage", code: 8, userInfo: [NSLocalizedDescriptionKey: "SQLite đang bận; chưa thể di chuyển dữ liệu an toàn."])
                }
                let closeResult = sqlite3_close_v2(currentDb)
                guard closeResult == SQLITE_OK else {
                    resultError = "Không thể đóng SQLite an toàn trước khi di chuyển."
                    return
                }
                db = nil

                try fileManager.createDirectory(at: stagingDirectory, withIntermediateDirectories: true)
                guard fileManager.fileExists(atPath: oldDbPath) else {
                    throw NSError(domain: "DunvexStorage", code: 1, userInfo: [NSLocalizedDescriptionKey: "Không tìm thấy cơ sở dữ liệu SQLite hiện tại."])
                }
                try fileManager.copyItem(atPath: oldDbPath, toPath: stagingDirectory.appendingPathComponent("dunvex_local.sqlite").path)

                let sourceImages = oldDirectory.appendingPathComponent("images", isDirectory: true)
                if fileManager.fileExists(atPath: sourceImages.path) {
                    let stagedImages = stagingDirectory.appendingPathComponent("images", isDirectory: true)
                    try fileManager.copyItem(at: sourceImages, to: stagedImages)
                    guard try Self.directoryStats(at: sourceImages) == Self.directoryStats(at: stagedImages) else {
                        throw NSError(domain: "DunvexStorage", code: 6, userInfo: [NSLocalizedDescriptionKey: "Không thể xác minh đầy đủ ảnh offline sau khi sao chép."])
                    }
                }

                try Self.validateDatabase(at: stagingDirectory.appendingPathComponent("dunvex_local.sqlite"))
                if fileManager.fileExists(atPath: targetDirectory.path) {
                    try fileManager.removeItem(at: targetDirectory)
                }
                try fileManager.moveItem(at: stagingDirectory, to: targetDirectory)
                destinationCreated = true

                settings.set(targetDirectory.path, forKey: "DunvexStorageDirectory")
                dataDirectory = targetDirectory
                dbPath = targetDbPath
                openDB()
                guard db != nil else {
                    throw NSError(domain: "DunvexStorage", code: 2, userInfo: [NSLocalizedDescriptionKey: "Không thể mở SQLite tại vị trí mới."])
                }
                destinationCreated = false

                do {
                    try fileManager.removeItem(atPath: oldDbPath)
                    try? fileManager.removeItem(atPath: oldDbPath + "-wal")
                    try? fileManager.removeItem(atPath: oldDbPath + "-shm")
                    let oldImages = oldDirectory.appendingPathComponent("images", isDirectory: true)
                    if fileManager.fileExists(atPath: oldImages.path) {
                        try fileManager.removeItem(at: oldImages)
                    }
                } catch {
                    print("[Storage] Old location cleanup failed after successful migration: \(error)")
                }
                resultPath = dbPath
            } catch {
                if let current = db {
                    sqlite3_close_v2(current)
                    db = nil
                }
                dataDirectory = oldDirectory
                dbPath = oldDbPath
                if hadStoredLocation {
                    settings.set(oldDirectory.path, forKey: "DunvexStorageDirectory")
                } else {
                    settings.removeObject(forKey: "DunvexStorageDirectory")
                }
                openDB()
                if destinationCreated {
                    try? fileManager.removeItem(at: targetDirectory)
                }
                try? fileManager.removeItem(at: stagingDirectory)
                resultError = error.localizedDescription
            }
        }
        return (resultPath, resultError)
    }

    private static func validateDatabase(at url: URL) throws {
        var validationDb: OpaquePointer?
        guard sqlite3_open(url.path, &validationDb) == SQLITE_OK, let validationDb else {
            throw NSError(domain: "DunvexStorage", code: 3, userInfo: [NSLocalizedDescriptionKey: "Không thể mở bản SQLite đã sao chép để kiểm tra."])
        }
        defer { sqlite3_close_v2(validationDb) }

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(validationDb, "PRAGMA integrity_check;", -1, &statement, nil) == SQLITE_OK else {
            throw NSError(domain: "DunvexStorage", code: 4, userInfo: [NSLocalizedDescriptionKey: "Không thể kiểm tra tính toàn vẹn SQLite."])
        }
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW,
              let result = sqlite3_column_text(statement, 0),
              String(cString: result).lowercased() == "ok" else {
            throw NSError(domain: "DunvexStorage", code: 5, userInfo: [NSLocalizedDescriptionKey: "SQLite không vượt qua kiểm tra toàn vẹn sau khi sao chép."])
        }
    }

    private static func directoryStats(at url: URL) throws -> (count: Int, bytes: Int64) {
        guard let enumerator = FileManager.default.enumerator(
            at: url,
            includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey],
            options: [.skipsPackageDescendants]
        ) else {
            throw NSError(domain: "DunvexStorage", code: 7, userInfo: [NSLocalizedDescriptionKey: "Không thể kiểm tra thư mục ảnh offline."])
        }

        var count = 0
        var bytes: Int64 = 0
        for case let fileUrl as URL in enumerator {
            let values = try fileUrl.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
            if values.isRegularFile == true {
                count += 1
                bytes += Int64(values.fileSize ?? 0)
            }
        }
        return (count, bytes)
    }

    private func initTables() {
        let sql = """
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
        );
        """
        queue.sync {
            guard let db = self.db else { return }
            if sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK {
                print("[SQLite] Core tables verified.")
            } else {
                let err = String(cString: sqlite3_errmsg(db))
                print("[SQLite] Schema verification warning: \(err)")
            }
        }
    }

    private func bind(stmt: OpaquePointer?, params: [Any]?) {
        guard let stmt = stmt, let params = params else { return }
        for (index, val) in params.enumerated() {
            let col = Int32(index + 1)
            if val is NSNull {
                sqlite3_bind_null(stmt, col)
            } else if let intVal = val as? Int {
                sqlite3_bind_int64(stmt, col, Int64(intVal))
            } else if let intVal = val as? Int64 {
                sqlite3_bind_int64(stmt, col, intVal)
            } else if let dblVal = val as? Double {
                sqlite3_bind_double(stmt, col, dblVal)
            } else if let boolVal = val as? Bool {
                sqlite3_bind_int(stmt, col, boolVal ? 1 : 0)
            } else if let strVal = val as? String {
                sqlite3_bind_text(stmt, col, (strVal as NSString).utf8String, -1, nil)
            } else {
                sqlite3_bind_text(stmt, col, ("\(val)" as NSString).utf8String, -1, nil)
            }
        }
    }

    func execute(sql: String, params: [Any]?) -> (rowsAffected: Int, lastInsertId: Int64, error: String?) {
        var res: (rowsAffected: Int, lastInsertId: Int64, error: String?) = (0, 0, nil)
        queue.sync {
            guard let db = self.db else {
                res = (0, 0, "Database not open")
                return
            }
            var stmt: OpaquePointer?
            if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) != SQLITE_OK {
                let err = String(cString: sqlite3_errmsg(db))
                res = (0, 0, err)
                return
            }
            bind(stmt: stmt, params: params)
            if sqlite3_step(stmt) != SQLITE_DONE {
                let err = String(cString: sqlite3_errmsg(db))
                sqlite3_finalize(stmt)
                res = (0, 0, err)
                return
            }
            sqlite3_finalize(stmt)
            let changes = Int(sqlite3_changes(db))
            let lastId = sqlite3_last_insert_rowid(db)
            res = (changes, lastId, nil)
        }
        return res
    }

    func query(sql: String, params: [Any]?) -> (rows: [[String: Any]], error: String?) {
        var res: (rows: [[String: Any]], error: String?) = ([], nil)
        queue.sync {
            guard let db = self.db else {
                res = ([], "Database not open")
                return
            }
            var stmt: OpaquePointer?
            if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) != SQLITE_OK {
                let err = String(cString: sqlite3_errmsg(db))
                res = ([], err)
                return
            }
            bind(stmt: stmt, params: params)
            var rows: [[String: Any]] = []
            let colCount = sqlite3_column_count(stmt)
            while sqlite3_step(stmt) == SQLITE_ROW {
                var row: [String: Any] = [:]
                for col in 0..<colCount {
                    let name = String(cString: sqlite3_column_name(stmt, col))
                    let type = sqlite3_column_type(stmt, col)
                    switch type {
                    case SQLITE_INTEGER:
                        row[name] = sqlite3_column_int64(stmt, col)
                    case SQLITE_FLOAT:
                        row[name] = sqlite3_column_double(stmt, col)
                    case SQLITE_TEXT:
                        if let cStr = sqlite3_column_text(stmt, col) {
                            row[name] = String(cString: cStr)
                        } else {
                            row[name] = ""
                        }
                    case SQLITE_NULL:
                        row[name] = NSNull()
                    default:
                        if let cStr = sqlite3_column_text(stmt, col) {
                            row[name] = String(cString: cStr)
                        } else {
                            row[name] = NSNull()
                        }
                    }
                }
                rows.append(row)
            }
            sqlite3_finalize(stmt)
            res = (rows, nil)
        }
        return res
    }

    func batch(statements: [[String: Any]]) -> (success: Bool, error: String?) {
        var res: (success: Bool, error: String?) = (false, nil)
        queue.sync {
            guard let db = self.db else {
                res = (false, "Database not open")
                return
            }
            sqlite3_exec(db, "BEGIN TRANSACTION;", nil, nil, nil)
            for item in statements {
                guard let sql = item["sql"] as? String else { continue }
                let params = item["params"] as? [Any]
                var stmt: OpaquePointer?
                if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) != SQLITE_OK {
                    let err = String(cString: sqlite3_errmsg(db))
                    sqlite3_exec(db, "ROLLBACK;", nil, nil, nil)
                    res = (false, err)
                    return
                }
                bind(stmt: stmt, params: params)
                if sqlite3_step(stmt) != SQLITE_DONE {
                    let err = String(cString: sqlite3_errmsg(db))
                    sqlite3_finalize(stmt)
                    sqlite3_exec(db, "ROLLBACK;", nil, nil, nil)
                    res = (false, err)
                    return
                }
                sqlite3_finalize(stmt)
            }
            sqlite3_exec(db, "COMMIT;", nil, nil, nil)
            res = (true, nil)
        }
        return res
    }
}

// ─── Native High-Performance Local Image & File Storage Manager ─
class LocalImageManager {
    static let shared = LocalImageManager()
    var imagesDir: URL {
        SQLiteManager.shared.dataDirectory.appendingPathComponent("images", isDirectory: true)
    }

    init() {}

    func saveImage(fileName: String, base64Data: String) -> (localPath: String, url: String)? {
        SQLiteManager.shared.withStorageLock {
            let cleanBase64 = base64Data.contains(",") ? String(base64Data.components(separatedBy: ",")[1]) : base64Data
            guard let data = Data(base64Encoded: cleanBase64) else { return nil }

            let sanitizedName = (fileName as NSString).lastPathComponent.replacingOccurrences(of: "[^a-zA-Z0-9_.-]", with: "_", options: .regularExpression)
            let finalName = sanitizedName.isEmpty ? "img_\(Int(Date().timeIntervalSince1970))_\(UUID().uuidString.prefix(6)).jpg" : sanitizedName
            let fileURL = imagesDir.appendingPathComponent(finalName)

            do {
                try FileManager.default.createDirectory(at: imagesDir, withIntermediateDirectories: true)
                try data.write(to: fileURL)
                let relativePath = "/local-images/\(finalName)"
                let fullUrl = "http://127.0.0.1:41738\(relativePath)"
                return (localPath: relativePath, url: fullUrl)
            } catch {
                print("[LocalImageManager] Failed to save image \(finalName): \(error)")
                return nil
            }
        }
    }

    func getImageData(fileName: String) -> Data? {
        SQLiteManager.shared.withStorageLock {
            let sanitizedName = (fileName as NSString).lastPathComponent
            let fileURL = imagesDir.appendingPathComponent(sanitizedName)
            return try? Data(contentsOf: fileURL)
        }
    }

    func deleteImage(fileName: String) -> Bool {
        SQLiteManager.shared.withStorageLock {
            let sanitizedName = (fileName as NSString).lastPathComponent
            let fileURL = imagesDir.appendingPathComponent(sanitizedName)
            do {
                if FileManager.default.fileExists(atPath: fileURL.path) {
                    try FileManager.default.removeItem(at: fileURL)
                    return true
                }
            } catch {
                print("[LocalImageManager] Failed to delete image \(fileName): \(error)")
            }
            return false
        }
    }

    func getStats() -> [String: Any] {
        SQLiteManager.shared.withStorageLock {
            var totalBytes: Int64 = 0
            var count = 0
            if let files = try? FileManager.default.contentsOfDirectory(at: imagesDir, includingPropertiesForKeys: [.fileSizeKey]) {
                count = files.count
                for file in files {
                    if let resourceValues = try? file.resourceValues(forKeys: [.fileSizeKey]), let size = resourceValues.fileSize {
                        totalBytes += Int64(size)
                    }
                }
            }
            return [
                "directory": imagesDir.path,
                "count": count,
                "totalBytes": totalBytes,
                "totalMB": String(format: "%.2f", Double(totalBytes) / (1024 * 1024))
            ]
        }
    }
}

// ─── OTA Auto-Update Manager (Over-The-Air via VPS) ───────────
class OTAUpdateManager {
    static let shared = OTAUpdateManager()

    let appDataDir: URL
    let liveWebDir: URL
    let versionFile: URL

    // VPS API Endpoint: defaults to https://dunvex.com (or configurable)
    var vpsApiOrigin: String = "https://dunvex.com"

    init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        appDataDir = appSupport.appendingPathComponent("Dunvex")
        liveWebDir = appDataDir.appendingPathComponent("web")
        versionFile = appDataDir.appendingPathComponent("ota_version_mac.json")
        try? FileManager.default.createDirectory(at: appDataDir, withIntermediateDirectories: true)
    }

    var effectiveDistPath: String {
        let indexHtml = liveWebDir.appendingPathComponent("index.html").path
        if FileManager.default.fileExists(atPath: indexHtml) {
            return liveWebDir.path
        }
        let bundleDist = Bundle.main.resourcePath.map { ($0 as NSString).appendingPathComponent("dist") } ?? ""
        if FileManager.default.fileExists(atPath: bundleDist) {
            return bundleDist
        }
        let projectDist = "/Volumes/DATA_SSD/Projects/Dunvex_Build-main/dist"
        if FileManager.default.fileExists(atPath: projectDist) {
            return projectDist
        }
        return bundleDist
    }

    func getLocalBuildNumber() -> Int {
        let hasLiveWeb = FileManager.default.fileExists(atPath: liveWebDir.appendingPathComponent("index.html").path)
        if hasLiveWeb,
           let data = try? Data(contentsOf: versionFile),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let buildNumber = json["buildNumber"] as? Int,
           buildNumber > 0 {
            return buildNumber
        }
        if hasLiveWeb {
            return 101
        }
        if let resourceURL = Bundle.main.resourceURL?.appendingPathComponent("dist/release-info.json"),
           let data = try? Data(contentsOf: resourceURL),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let buildNumber = json["buildNumber"] as? Int {
            return buildNumber
        }
        return 101 // baseline build
    }

    func checkForUpdates(webView: WKWebView?, silent: Bool = true, completion: ((Bool, String) -> Void)? = nil) {
        guard let url = URL(string: "\(vpsApiOrigin)/api/releases/mac/version") else { return }

        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 10

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            guard let data = data, error == nil,
                  let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let serverBuild = json["buildNumber"] as? Int,
                  serverBuild > 0 else {
                if !silent {
                    DispatchQueue.main.async {
                        let alert = NSAlert()
                        alert.messageText = "Kiểm tra cập nhật"
                        alert.informativeText = "Không thể kết nối đến máy chủ cập nhật VPS hoặc mạng đang gián đoạn."
                        alert.addButton(withTitle: "Đóng")
                        alert.runModal()
                    }
                }
                completion?(false, "Không thể kết nối máy chủ")
                return
            }

            let localBuild = self.getLocalBuildNumber()
            let serverVersion = (json["version"] as? String) ?? "1.0.1"
            let releaseNotes = (json["releaseNotes"] as? String) ?? "Bản cập nhật mới"
            let bundleUrlStr = (json["bundleUrl"] as? String) ?? "/api/releases/mac/bundle.zip"
            let bundleHash = json["bundleHash"] as? String

            if serverBuild > localBuild {
                print("[OTA] New update available: Build \(serverBuild) (Local: \(localBuild)). Downloading...")
                self.downloadAndApplyBundle(bundleUrlStr: bundleUrlStr, bundleHash: bundleHash, serverBuild: serverBuild, serverVersion: serverVersion, releaseNotes: releaseNotes, webView: webView, silent: silent, completion: completion)
            } else {
                print("[OTA] Already up to date. Local: \(localBuild), Server: \(serverBuild)")
                if !silent {
                    DispatchQueue.main.async {
                        let alert = NSAlert()
                        alert.messageText = "Dunvex POS & Production"
                        alert.informativeText = "Bạn đang sử dụng phiên bản mới nhất (v\(serverVersion) - Build \(localBuild))."
                        alert.addButton(withTitle: "Tuyệt vời")
                        alert.runModal()
                    }
                }
                completion?(true, "Đang ở bản mới nhất")
            }
        }.resume()
    }

    private func reportUpdateFailure(_ message: String, silent: Bool, completion: ((Bool, String) -> Void)?) {
        print("[OTA] Update failed: \(message)")
        completion?(false, message)
        guard !silent else { return }
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = "Cập nhật không thành công"
            alert.informativeText = message
            alert.addButton(withTitle: "Đóng")
            alert.runModal()
        }
    }

    private func downloadAndApplyBundle(bundleUrlStr: String, bundleHash: String?, serverBuild: Int, serverVersion: String, releaseNotes: String, webView: WKWebView?, silent: Bool, completion: ((Bool, String) -> Void)?) {
        let fullUrlStr = bundleUrlStr.starts(with: "http") ? bundleUrlStr : "\(vpsApiOrigin)\(bundleUrlStr)"
        guard let url = URL(string: fullUrlStr) else {
            reportUpdateFailure("Địa chỉ gói cập nhật không hợp lệ.", silent: silent, completion: completion)
            return
        }

        let task = URLSession.shared.downloadTask(with: url) { [weak self] tempLocation, response, error in
            guard let self = self else { return }
            guard let tempLocation = tempLocation,
                  error == nil,
                  let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                self.reportUpdateFailure("Không tải được gói cập nhật (HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0)). \(error?.localizedDescription ?? "")", silent: silent, completion: completion)
                return
            }

            let tmpExtractDir = self.appDataDir.appendingPathComponent("web_tmp_\(Date().timeIntervalSince1970)")
            let fileManager = FileManager.default
            do {
                if let expectedHash = bundleHash, !expectedHash.isEmpty {
                    let bundleData = try Data(contentsOf: tempLocation)
                    let actualHash = SHA256.hash(data: bundleData).map { String(format: "%02x", $0) }.joined()
                    guard actualHash.caseInsensitiveCompare(expectedHash) == .orderedSame else {
                        throw NSError(domain: "DunvexOTA", code: 1, userInfo: [NSLocalizedDescriptionKey: "Mã kiểm tra gói cập nhật không khớp."])
                    }
                }

                try fileManager.createDirectory(at: tmpExtractDir, withIntermediateDirectories: true)
                let process = Process()
                process.executableURL = URL(fileURLWithPath: "/usr/bin/ditto")
                process.arguments = ["-xk", tempLocation.path, tmpExtractDir.path]
                try process.run()
                process.waitUntilExit()
                guard process.terminationStatus == 0,
                      fileManager.fileExists(atPath: tmpExtractDir.appendingPathComponent("index.html").path) else {
                    throw NSError(domain: "DunvexOTA", code: 2, userInfo: [NSLocalizedDescriptionKey: "Gói cập nhật không hợp lệ hoặc không giải nén được."])
                }

                let liveWeb = self.liveWebDir
                let previousWeb = self.appDataDir.appendingPathComponent("web_old")
                try? fileManager.removeItem(at: previousWeb)
                var movedPreviousWeb = false
                if fileManager.fileExists(atPath: liveWeb.path) {
                    try fileManager.moveItem(at: liveWeb, to: previousWeb)
                    movedPreviousWeb = true
                }
                do {
                    try fileManager.moveItem(at: tmpExtractDir, to: liveWeb)
                } catch {
                    if movedPreviousWeb {
                        try? fileManager.moveItem(at: previousWeb, to: liveWeb)
                    }
                    throw error
                }

                let meta: [String: Any] = [
                    "version": serverVersion,
                    "buildNumber": serverBuild,
                    "updatedAt": Date().timeIntervalSince1970,
                    "releaseNotes": releaseNotes
                ]
                do {
                    let metaData = try JSONSerialization.data(withJSONObject: meta)
                    try metaData.write(to: self.versionFile, options: .atomic)
                } catch {
                    try? fileManager.removeItem(at: liveWeb)
                    if movedPreviousWeb {
                        try? fileManager.moveItem(at: previousWeb, to: liveWeb)
                    }
                    throw error
                }
                if movedPreviousWeb { try? fileManager.removeItem(at: previousWeb) }

                print("[OTA] Successfully updated to Build \(serverBuild) (v\(serverVersion))!")

                DispatchQueue.main.async {
                    if !silent {
                        let alert = NSAlert()
                        alert.messageText = "Đã cập nhật thành công!"
                        alert.informativeText = "Ứng dụng đã tự động nâng cấp lên phiên bản v\(serverVersion) (Build \(serverBuild)).\nNội dung: \(releaseNotes)\n\nNhấn 'Tải lại' để sử dụng ngay."
                        alert.addButton(withTitle: "Tải lại ngay")
                        alert.addButton(withTitle: "Để sau")
                        let resp = alert.runModal()
                        if resp == .alertFirstButtonReturn {
                            webView?.reloadFromOrigin()
                        }
                    }
                }
                completion?(true, "Cập nhật thành công")
            } catch {
                try? fileManager.removeItem(at: tmpExtractDir)
                self.reportUpdateFailure(error.localizedDescription, silent: silent, completion: completion)
            }
        }
        task.resume()
    }
}

// ─── Embedded High-Performance Local HTTP Server (Pure Swift) ─
class LocalEmbeddedServer {
    private var listener: NWListener?
    var distPath: String {
        return OTAUpdateManager.shared.effectiveDistPath
    }
    let port: UInt16 = 41738
    var onReady: (() -> Void)?
    private(set) var isReady: Bool = false

    init() {}

    func start() {
        do {
            let params = NWParameters.tcp
            // Security: Strictly enforce loopback interface only (127.0.0.1 / ::1)
            params.requiredInterfaceType = .loopback
            params.allowLocalEndpointReuse = true

            listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: port)!)
            listener?.stateUpdateHandler = { [weak self] state in
                guard let self = self else { return }
                switch state {
                case .ready:
                    self.isReady = true
                    print("[LocalServer] Running securely on http://127.0.0.1:\(self.port) serving: \(self.distPath)")
                    self.onReady?()
                case .failed(let err):
                    print("[LocalServer] Failed: \(err)")
                default:
                    break
                }
            }
            listener?.newConnectionHandler = { [weak self] connection in
                self?.handleConnection(connection)
            }
            listener?.start(queue: .global(qos: .userInitiated))
        } catch {
            print("[LocalServer] Could not start: \(error)")
        }
    }

    private func handleConnection(_ connection: NWConnection) {
        if case let .hostPort(host, _) = connection.endpoint {
            let hostStr = "\(host)"
            if hostStr != "127.0.0.1" && hostStr != "::1" && hostStr != "localhost" {
                print("[Security] Dropping non-loopback connection from: \(hostStr)")
                connection.cancel()
                return
            }
        }
        connection.start(queue: .global(qos: .userInitiated))
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, _ in
            guard let self = self, let data = data, let reqStr = String(data: data, encoding: .utf8) else {
                connection.cancel()
                return
            }

            let firstLine = reqStr.components(separatedBy: "\r\n").first ?? ""
            let parts = firstLine.components(separatedBy: " ")
            guard parts.count >= 2 else {
                connection.cancel()
                return
            }

            var requestPath = parts[1]
            if let qIdx = requestPath.firstIndex(of: "?") {
                requestPath = String(requestPath[..<qIdx])
            }

            guard let decodedPath = requestPath.removingPercentEncoding else {
                self.sendResponse(connection: connection, status: "400 Bad Request", mime: "text/plain", body: Data())
                return
            }

            // Security: Canonicalize dist path and verify target remains strictly within dist
            let canonicalDistURL = URL(fileURLWithPath: self.distPath).standardized.resolvingSymlinksInPath()
            let canonicalDistPath = canonicalDistURL.path

            let sanitizedRelative = (decodedPath == "/" || decodedPath.isEmpty) ? "index.html" : decodedPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let candidateURL = canonicalDistURL.appendingPathComponent(sanitizedRelative).standardized.resolvingSymlinksInPath()

            // 1. Check if request is for local image asset (/local-images/...)
            if sanitizedRelative.hasPrefix("local-images/") {
                let imgSubPath = String(sanitizedRelative.dropFirst("local-images/".count))
                let fileName = (imgSubPath as NSString).lastPathComponent
                if fileName == imgSubPath, !fileName.isEmpty,
                   let content = LocalImageManager.shared.getImageData(fileName: fileName) {
                    let mime = self.mimeType(for: fileName)
                    self.sendResponse(connection: connection, status: "200 OK", mime: mime, body: content)
                    return
                }
                self.sendResponse(connection: connection, status: "404 Not Found", mime: "text/plain", body: Data())
                return
            }

            guard candidateURL.path == canonicalDistPath || candidateURL.path.hasPrefix(canonicalDistPath + "/") else {
                print("[Security] Blocked path traversal attempt: \(decodedPath)")
                self.sendResponse(connection: connection, status: "403 Forbidden", mime: "text/plain", body: "Forbidden".data(using: .utf8)!)
                return
            }

            var targetURL = candidateURL
            var fileData = try? Data(contentsOf: targetURL)

            // SPA Fallback: if not found and doesn't have an extension, serve index.html
            if fileData == nil && !sanitizedRelative.contains(".") {
                let indexURL = canonicalDistURL.appendingPathComponent("index.html").standardized.resolvingSymlinksInPath()
                if indexURL.path.hasPrefix(canonicalDistPath) {
                    targetURL = indexURL
                    fileData = try? Data(contentsOf: targetURL)
                }
            }

            if let content = fileData {
                let mime = self.mimeType(for: targetURL.path)
                self.sendResponse(connection: connection, status: "200 OK", mime: mime, body: content)
            } else {
                self.sendResponse(connection: connection, status: "404 Not Found", mime: "text/plain", body: Data())
            }
        }
    }

    private func sendResponse(connection: NWConnection, status: String, mime: String, body: Data) {
        var header = "HTTP/1.1 \(status)\r\n"
        header += "Content-Type: \(mime)\r\n"
        header += "Content-Length: \(body.count)\r\n"
        header += "Connection: close\r\n"
        header += "Cache-Control: no-cache, no-store, must-revalidate\r\n"
        header += "Pragma: no-cache\r\n"
        header += "Expires: 0\r\n"
        header += "X-Content-Type-Options: nosniff\r\n"
        header += "X-Frame-Options: SAMEORIGIN\r\n\r\n"
        var respData = header.data(using: .utf8) ?? Data()
        respData.append(body)
        connection.send(content: respData, completion: .contentProcessed({ _ in
            connection.cancel()
        }))
    }

    private func mimeType(for path: String) -> String {
        let ext = (path as NSString).pathExtension.lowercased()
        switch ext {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        case "webmanifest": return "application/manifest+json"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        default: return "application/octet-stream"
        }
    }
}

// ─── Native App Delegate ─────────────────────────────────────
class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    var printWebView: WKWebView?
    var localServer: LocalEmbeddedServer?

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        startEmbeddedServer()

        let screenSize = NSScreen.main?.visibleFrame.size ?? CGSize(width: 1280, height: 800)
        let windowWidth = min(1440, screenSize.width * 0.92)
        let windowHeight = min(920, screenSize.height * 0.92)
        let windowRect = NSRect(
            x: (screenSize.width - windowWidth) / 2,
            y: (screenSize.height - windowHeight) / 2,
            width: windowWidth,
            height: windowHeight
        )

        window = NSWindow(
            contentRect: windowRect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "Dunvex POS"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.minSize = NSSize(width: 960, height: 600)
        window.isReleasedWhenClosed = false

        // User Content Controller with Native Bridges
        let userContentController = WKUserContentController()
        userContentController.add(self, name: "printHandler")
        userContentController.add(self, name: "nativeBridge")
        userContentController.add(self, name: "sqliteBridge")
        userContentController.add(self, name: "biometricBridge")
        userContentController.add(self, name: "fileBridge")

        let macFlagScript = WKUserScript(
            source: "window.DunvexMac = true; window.isNativeMac = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        userContentController.addUserScript(macFlagScript)
        // WKWebView Configuration for High-Performance Desktop
        let config = WKWebViewConfiguration()
        config.userContentController = userContentController
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.websiteDataStore = WKWebsiteDataStore.default()

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.allowsBackForwardNavigationGestures = false
        webView.navigationDelegate = self
        webView.uiDelegate = self

        window.contentView?.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        setupMenu()

        // Check for OTA Updates in background after 3 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
            OTAUpdateManager.shared.checkForUpdates(webView: self?.webView, silent: true)
        }
    }

    private func startEmbeddedServer() {
        let distToUse = OTAUpdateManager.shared.effectiveDistPath
        print("[DunvexApp] Initial effective web directory: \(distToUse)")

        localServer = LocalEmbeddedServer()
        localServer?.onReady = { [weak self] in
            DispatchQueue.main.async {
                self?.loadApp()
            }
        }
        localServer?.start()

        // Fallback startup trigger in case state ready fired before handler attached
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.loadApp()
        }
    }

    func setupMenu() {
        let mainMenu = NSMenu()
        
        // App Menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "Về Dunvex Build (v1.0.1)", action: #selector(showAbout), keyEquivalent: "")
        appMenu.addItem(withTitle: "Mở vị trí dữ liệu SQLite (Finder)...", action: #selector(openDatabaseFolder), keyEquivalent: "d")
        appMenu.addItem(withTitle: "Mở thư mục ảnh cục bộ (Finder)...", action: #selector(openImagesFolder), keyEquivalent: "i")
        appMenu.addItem(withTitle: "Kiểm tra cập nhật phiên bản...", action: #selector(checkForUpdates), keyEquivalent: "u")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Đồng bộ dữ liệu với máy chủ (Full Sync)", action: #selector(triggerFullSync), keyEquivalent: "s")
        appMenu.addItem(withTitle: "Làm mới trang (Reload)", action: #selector(reloadPage), keyEquivalent: "r")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Đóng cửa sổ", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        appMenu.addItem(withTitle: "Thoát Dunvex", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // Edit Menu
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Chỉnh sửa")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "Cắt (Cut)", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Sao chép (Copy)", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Dán (Paste)", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Chọn tất cả (Select All)", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        // View Menu
        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "Xem")
        viewMenuItem.submenu = viewMenu
        viewMenu.addItem(withTitle: "Tải lại trang", action: #selector(reloadPage), keyEquivalent: "R")
        viewMenu.addItem(withTitle: "Toàn màn hình", action: #selector(toggleFullScreen), keyEquivalent: "f")

        NSApp.mainMenu = mainMenu
    }

    @objc func showAbout() {
        let alert = NSAlert()
        alert.messageText = "Dunvex POS & Production"
        alert.informativeText = "Phiên bản: 1.0.1 (Build 101)\nKiến trúc: Offline-First Native Mac (Native SQLite & RAM Engine)\nĐường dẫn DB: \(SQLiteManager.shared.currentDatabasePath())\nBản quyền © 2026 Dunvex."
        alert.addButton(withTitle: "Đóng")
        alert.runModal()
    }

    @objc func openDatabaseFolder() {
        let path = SQLiteManager.shared.currentDatabasePath()
        if FileManager.default.fileExists(atPath: path) {
            NSWorkspace.shared.selectFile(path, inFileViewerRootedAtPath: "")
        } else {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            let dunvexDir = appSupport.appendingPathComponent("Dunvex")
            NSWorkspace.shared.open(dunvexDir)
        }
    }

    @objc func openImagesFolder() {
        let dir = LocalImageManager.shared.imagesDir
        NSWorkspace.shared.open(dir)
    }

    @objc func checkForUpdates() {
        OTAUpdateManager.shared.checkForUpdates(webView: webView, silent: false)
    }

    @objc func triggerFullSync() {
        webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('trigger_full_sync', { detail: { force: true } }))", completionHandler: nil)
    }

    @objc func reloadPage() {
        let websiteDataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        let date = Date(timeIntervalSince1970: 0)
        WKWebsiteDataStore.default().removeData(ofTypes: [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache], modifiedSince: date) { [weak self] in
            DispatchQueue.main.async {
                self?.webView?.reloadFromOrigin()
            }
        }
    }

    @objc func toggleFullScreen() {
        window?.toggleFullScreen(nil)
    }

    private var hasLoadedApp = false

    func loadApp() {
        guard !hasLoadedApp else { return }
        hasLoadedApp = true

        let isDevMode = CommandLine.arguments.contains("--dev")
        if isDevMode {
            checkUrlAlive(urlString: "http://localhost:5173") { [weak self] alive in
                DispatchQueue.main.async {
                    if alive {
                        print("[Dunvex] Loading active Vite dev server at http://localhost:5173")
                        self?.webView.load(URLRequest(url: URL(string: "http://localhost:5173")!))
                    } else {
                        self?.loadEmbeddedApp()
                    }
                }
            }
        } else {
            loadEmbeddedApp()
        }
    }

    private func loadEmbeddedApp() {
        let localPort = localServer?.port ?? 41738
        guard let url = URL(string: "http://127.0.0.1:\(localPort)") else { return }
        print("[Dunvex] Loading standalone embedded bundle at \(url.absoluteString)")
        webView.load(URLRequest(url: url))
    }

    private func checkUrlAlive(urlString: String, completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: urlString) else {
            completion(false)
            return
        }
        let req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 0.5)
        let task = URLSession.shared.dataTask(with: req) { (_, response, _) in
            if let httpRes = response as? HTTPURLResponse, httpRes.statusCode == 200 {
                completion(true)
            } else {
                completion(false)
            }
        }
        task.resume()
    }

    // ─── Native Script Message Handler ───────────────────────
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Security 1: Verify message is strictly from the main frame
        guard message.frameInfo.isMainFrame else {
            print("[Security] Blocked bridge call from non-main frame")
            return
        }

        // Security 2: Verify securityOrigin host and port
        let origin = message.frameInfo.securityOrigin
        let localPort = Int(localServer?.port ?? 41738)
        let isDevMode = CommandLine.arguments.contains("--dev")

        let isAllowedOrigin = origin.protocol == "http" && (
            (origin.host == "127.0.0.1" && origin.port == localPort) ||
            (isDevMode && origin.host == "localhost" && origin.port == 5173)
        )

        guard isAllowedOrigin else {
            print("[Security] Blocked bridge call from unauthorized origin: \(origin.protocol)://\(origin.host):\(origin.port)")
            return
        }

        if message.name == "printHandler", let body = message.body as? [String: Any], let html = body["html"] as? String {
            let isReceipt = (body["isReceipt"] as? Bool) ?? false
            let paperSize = (body["paperSize"] as? String) ?? (isReceipt ? "k80" : "a4")
            printHtmlContent(html: html, isReceipt: isReceipt, paperSize: paperSize)
        } else if message.name == "nativeBridge", let body = message.body as? [String: Any] {
            handleNativeBridgeMessage(body)
        } else if message.name == "sqliteBridge", let body = message.body as? [String: Any] {
            handleSqliteBridgeMessage(body)
        } else if message.name == "biometricBridge", let body = message.body as? [String: Any] {
            handleBiometricBridgeMessage(body)
        } else if message.name == "fileBridge", let body = message.body as? [String: Any] {
            handleFileBridgeMessage(body)
        }
    }

    private func handleNativeBridgeMessage(_ body: [String: Any]) {
        let action = body["action"] as? String ?? ""
        let silent = (body["silent"] as? Bool) ?? false
        if action == "checkForUpdates" {
            DispatchQueue.main.async { [weak self] in
                OTAUpdateManager.shared.checkForUpdates(webView: self?.webView, silent: silent)
            }
        } else if action == "reload" {
            DispatchQueue.main.async { [weak self] in
                self?.reloadPage()
            }
        }
    }

    private let allowedTables: Set<String> = [
        "customers", "products", "orders", "order_items", "generic_documents", "app_metadata"
    ]

    private func isSafeSqlStatement(_ sql: String) -> Bool {
        let trimmed = sql.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return false }

        let cleanSql = trimmed.hasSuffix(";") ? String(trimmed.dropLast()).trimmingCharacters(in: .whitespacesAndNewlines) : trimmed

        // Disallow statement stacking and comments
        if cleanSql.contains(";") || cleanSql.contains("--") || cleanSql.contains("/*") {
            return false
        }

        let upper = cleanSql.uppercased()

        // Disallow dangerous keywords
        let forbidden = [
            "ATTACH", "DETACH", "DROP", "ALTER", "CREATE", "PRAGMA", "VACUUM",
            "LOAD_EXTENSION", "XP_", "EXEC", "SHUTDOWN", "REINDEX", "GRANT", "REVOKE", "TRUNCATE"
        ]
        for kw in forbidden {
            if upper == kw || upper.hasPrefix(kw + " ") || upper.contains(" " + kw + " ") || upper.hasSuffix(" " + kw) {
                return false
            }
        }

        let isAllowedVerb = upper.hasPrefix("SELECT") ||
                            upper.hasPrefix("INSERT") ||
                            upper.hasPrefix("UPDATE") ||
                            upper.hasPrefix("DELETE")
        guard isAllowedVerb else { return false }

        // Must target one of the predefined whitelist tables
        var matchesAllowedTable = false
        for table in allowedTables {
            if upper.contains(table.uppercased()) {
                matchesAllowedTable = true
                break
            }
        }
        return matchesAllowedTable
    }

    private func handleSqliteBridgeMessage(_ body: [String: Any]) {
        let requestId = body["requestId"] as? String ?? ""
        let action = body["action"] as? String ?? ""
        let normalizedAction = action
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "_", with: "")
            .replacingOccurrences(of: "-", with: "")
            .lowercased()

        if normalizedAction == "choosestorageLocation".lowercased() {
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                let panel = NSOpenPanel()
                panel.canChooseDirectories = true
                panel.canChooseFiles = false
                panel.canCreateDirectories = true
                panel.allowsMultipleSelection = false
                panel.message = "Chọn ổ đĩa hoặc thư mục chứa dữ liệu Dunvex"
                panel.prompt = "Chọn thư mục"

                guard panel.runModal() == .OK, let selectedUrl = panel.url else {
                    self.sendSQLiteBridgeCallback(requestId: requestId, result: ["cancelled": true], error: nil)
                    return
                }
                let targetDirectory = selectedUrl.appendingPathComponent("DunvexData", isDirectory: true)
                let confirmation = NSAlert()
                confirmation.messageText = "Xác nhận chuyển dữ liệu"
                confirmation.informativeText = "SQLite và ảnh offline sẽ được chuyển sang:\n\(targetDirectory.path)\n\nỔ đĩa cần luôn được kết nối. Tiếp tục?"
                confirmation.addButton(withTitle: "Chuyển dữ liệu")
                confirmation.addButton(withTitle: "Hủy")
                guard confirmation.runModal() == .alertFirstButtonReturn else {
                    self.sendSQLiteBridgeCallback(requestId: requestId, result: ["cancelled": true], error: nil)
                    return
                }

                DispatchQueue.global(qos: .userInitiated).async {
                    let result = SQLiteManager.shared.changeStorageLocation(parentPath: selectedUrl.path)
                    if let error = result.error {
                        self.sendSQLiteBridgeCallback(requestId: requestId, result: nil, error: error)
                    } else {
                        self.sendSQLiteBridgeCallback(
                            requestId: requestId,
                            result: ["cancelled": false, "dbPath": result.dbPath ?? ""],
                            error: nil
                        )
                    }
                }
            }
            return
        }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            var resultData: Any? = nil
            var errorString: String? = nil

            switch normalizedAction {
            case "ping":
                let storageInfo = SQLiteManager.shared.storageInfo()
                guard storageInfo.isOpen else {
                    errorString = "Không mở được SQLite tại vị trí lưu đã chọn. Hãy kết nối lại ổ đĩa."
                    break
                }
                resultData = [
                    "status": "ok",
                    "dbPath": storageInfo.dbPath,
                    "supportsStorageLocationSelection": true
                ]
            case "execute":
                let sql = body["sql"] as? String ?? ""
                guard self.isSafeSqlStatement(sql) else {
                    errorString = "Disallowed or unsafe SQL statement"
                    break
                }
                let params = body["params"] as? [Any]
                let res = SQLiteManager.shared.execute(sql: sql, params: params)
                if let err = res.error {
                    errorString = err
                } else {
                    resultData = [
                        "rowsAffected": res.rowsAffected,
                        "lastInsertId": res.lastInsertId
                    ]
                }
            case "query":
                let sql = body["sql"] as? String ?? ""
                guard self.isSafeSqlStatement(sql) else {
                    errorString = "Disallowed or unsafe SQL query"
                    break
                }
                let params = body["params"] as? [Any]
                let res = SQLiteManager.shared.query(sql: sql, params: params)
                if let err = res.error {
                    errorString = err
                } else {
                    resultData = res.rows
                }
            case "batch":
                let statements = body["statements"] as? [[String: Any]] ?? []
                var isSafe = true
                for stmt in statements {
                    let sql = stmt["sql"] as? String ?? ""
                    if !self.isSafeSqlStatement(sql) {
                        isSafe = false
                        break
                    }
                }
                guard isSafe else {
                    errorString = "Batch contains disallowed or unsafe SQL statement"
                    break
                }
                let res = SQLiteManager.shared.batch(statements: statements)
                if let err = res.error {
                    errorString = err
                } else {
                    resultData = ["success": true]
                }
            default:
                errorString = "Unknown sqlite action: \(action)"
            }

            self.sendSQLiteBridgeCallback(requestId: requestId, result: resultData, error: errorString)
        }
    }

    private func sendSQLiteBridgeCallback(requestId: String, result: Any?, error: String?) {
        DispatchQueue.main.async { [weak self] in
            guard let self, !requestId.isEmpty else { return }
            var js: String
            if let error {
                let escaped = error.replacingOccurrences(of: "\\", with: "\\\\")
                    .replacingOccurrences(of: "\"", with: "\\\"")
                    .replacingOccurrences(of: "\n", with: "\\n")
                js = "window.__sqliteBridgeCallback && window.__sqliteBridgeCallback('\(requestId)', null, \"\(escaped)\");"
            } else {
                let serialized = (try? JSONSerialization.data(withJSONObject: result ?? NSNull(), options: [])) ?? Data()
                let jsonString = String(data: serialized, encoding: .utf8) ?? "null"
                js = "window.__sqliteBridgeCallback && window.__sqliteBridgeCallback('\(requestId)', \(jsonString), null);"
            }
            self.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func handleBiometricBridgeMessage(_ body: [String: Any]) {
        let requestId = body["requestId"] as? String ?? ""
        let action = body["action"] as? String ?? ""

        switch action {
        case "isAvailable":
            let context = LAContext()
            var error: NSError?
            let canBio = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
            let canDevice = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
            let res: [String: Any] = [
                "available": canBio || canDevice,
                "hasTouchId": canBio,
                "biometryType": context.biometryType == .touchID ? "touchID" : (context.biometryType == .faceID ? "faceID" : "passcode")
            ]
            sendBiometricCallback(requestId: requestId, data: res, error: nil)

        case "authenticate":
            let reason = body["reason"] as? String ?? "Đăng nhập vào Dunvex Build bằng vân tay Touch ID"
            let context = LAContext()
            context.localizedCancelTitle = "Dùng mật khẩu"

            let policy: LAPolicy = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
                ? .deviceOwnerAuthenticationWithBiometrics
                : .deviceOwnerAuthentication

            context.evaluatePolicy(policy, localizedReason: reason) { [weak self] success, authError in
                DispatchQueue.main.async {
                    if success {
                        self?.sendBiometricCallback(requestId: requestId, data: ["success": true], error: nil)
                    } else {
                        let errMsg = authError?.localizedDescription ?? "Xác thực vân tay không thành công"
                        self?.sendBiometricCallback(requestId: requestId, data: nil, error: errMsg)
                    }
                }
            }

        default:
            sendBiometricCallback(requestId: requestId, data: nil, error: "Unknown biometric action")
        }
    }

    private func sendBiometricCallback(requestId: String, data: Any?, error: String?) {
        guard !requestId.isEmpty else { return }
        var js = ""
        if let err = error {
            let escaped = err.replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "\"", with: "\\\"")
                .replacingOccurrences(of: "\n", with: "\\n")
            js = "window.__biometricBridgeCallback && window.__biometricBridgeCallback('\(requestId)', null, \"\(escaped)\");"
        } else {
            let serialized = (try? JSONSerialization.data(withJSONObject: data ?? NSNull(), options: [])) ?? Data()
            let jsonStr = String(data: serialized, encoding: .utf8) ?? "null"
            js = "window.__biometricBridgeCallback && window.__biometricBridgeCallback('\(requestId)', \(jsonStr), null);"
        }
        self.webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    private func handleFileBridgeMessage(_ body: [String: Any]) {
        let requestId = body["requestId"] as? String ?? ""
        let action = body["action"] as? String ?? ""

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            var resultData: Any? = nil
            var errorString: String? = nil

            switch action {
            case "ping", "getStats":
                resultData = LocalImageManager.shared.getStats()
            case "saveImage":
                let fileName = body["fileName"] as? String ?? ""
                let base64 = body["base64"] as? String ?? ""
                if let saved = LocalImageManager.shared.saveImage(fileName: fileName, base64Data: base64) {
                    resultData = [
                        "success": true,
                        "localPath": saved.localPath,
                        "url": saved.url
                    ]
                } else {
                    errorString = "Failed to save local image file"
                }
            case "getImage":
                let fileName = body["fileName"] as? String ?? ""
                if let data = LocalImageManager.shared.getImageData(fileName: fileName) {
                    resultData = [
                        "success": true,
                        "base64": data.base64EncodedString()
                    ]
                } else {
                    errorString = "Image file not found"
                }
            case "deleteImage":
                let fileName = body["fileName"] as? String ?? ""
                let success = LocalImageManager.shared.deleteImage(fileName: fileName)
                resultData = ["success": success]
            case "copyImage":
                let base64 = body["base64"] as? String ?? ""
                let cleanBase64 = base64.components(separatedBy: ",").last ?? base64
                if let imgData = Data(base64Encoded: cleanBase64),
                   NSImage(data: imgData) != nil {
                    let copied = DispatchQueue.main.sync {
                        let pasteboard = NSPasteboard.general
                        pasteboard.clearContents()
                        pasteboard.setData(imgData, forType: .png)
                        return pasteboard.data(forType: .png) != nil
                    }
                    if copied {
                        resultData = ["success": true]
                    } else {
                        errorString = "Không thể ghi ảnh vào bộ nhớ tạm của macOS."
                    }
                } else {
                    errorString = "Invalid image base64 data for pasteboard"
                }
            case "openFolder":
                let imagesDirectory = SQLiteManager.shared.withStorageLock {
                    LocalImageManager.shared.imagesDir
                }
                DispatchQueue.main.async {
                    NSWorkspace.shared.open(imagesDirectory)
                }
                resultData = ["success": true]
            default:
                errorString = "Unknown file bridge action: \(action)"
            }

            DispatchQueue.main.async {
                self.sendFileCallback(requestId: requestId, data: resultData, error: errorString)
            }
        }
    }

    private func sendFileCallback(requestId: String, data: Any?, error: String?) {
        guard !requestId.isEmpty else { return }
        var js = ""
        if let err = error {
            let escaped = err.replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "\"", with: "\\\"")
                .replacingOccurrences(of: "\n", with: "\\n")
            js = "window.__fileBridgeCallback && window.__fileBridgeCallback('\(requestId)', null, \"\(escaped)\");"
        } else {
            let serialized = (try? JSONSerialization.data(withJSONObject: data ?? NSNull(), options: [])) ?? Data()
            let jsonStr = String(data: serialized, encoding: .utf8) ?? "null"
            js = "window.__fileBridgeCallback && window.__fileBridgeCallback('\(requestId)', \(jsonStr), null);"
        }
        self.webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    func printHtmlContent(html: String, isReceipt: Bool, paperSize: String = "a4") {
        let normalizedPaperSize = paperSize.lowercased()
        let isThermal = normalizedPaperSize == "k80" || normalizedPaperSize == "k57"
        let printConfig = WKWebViewConfiguration()
        let pWebView = WKWebView(frame: NSRect(x: 0, y: 0, width: isThermal ? 300 : 800, height: 1000), configuration: printConfig)
        self.printWebView = pWebView

        class PrintNavDelegate: NSObject, WKNavigationDelegate {
            let parentWindow: NSWindow
            let isReceipt: Bool
            let normalizedPaperSize: String
            init(window: NSWindow, isReceipt: Bool, paperSize: String) {
                self.parentWindow = window
                self.isReceipt = isReceipt
                self.normalizedPaperSize = paperSize.lowercased()
            }

            func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    let printInfo = NSPrintInfo.shared
                    printInfo.isHorizontallyCentered = true
                    printInfo.isVerticallyCentered = false
                    printInfo.horizontalPagination = .fit
                    printInfo.verticalPagination = self.isReceipt || self.normalizedPaperSize == "k80" || self.normalizedPaperSize == "k57" ? .automatic : .fit
                    if self.normalizedPaperSize == "k57" {
                        printInfo.paperSize = NSSize(width: 170, height: 650) // 57mm thermal receipt
                        printInfo.leftMargin = 0
                        printInfo.rightMargin = 0
                        printInfo.topMargin = 0
                        printInfo.bottomMargin = 0
                    } else if self.normalizedPaperSize == "k80" || self.isReceipt {
                        printInfo.paperSize = NSSize(width: 226, height: 800) // 80mm thermal receipt
                        printInfo.leftMargin = 0
                        printInfo.rightMargin = 0
                        printInfo.topMargin = 0
                        printInfo.bottomMargin = 0
                    } else if self.normalizedPaperSize == "a5" {
                        printInfo.paperSize = NSSize(width: 420, height: 595) // A5 portrait
                        printInfo.leftMargin = 10
                        printInfo.rightMargin = 10
                        printInfo.topMargin = 10
                        printInfo.bottomMargin = 10
                    } else {
                        printInfo.paperSize = NSSize(width: 595.28, height: 841.89) // A4 standard
                        printInfo.leftMargin = 14
                        printInfo.rightMargin = 14
                        printInfo.topMargin = 14
                        printInfo.bottomMargin = 14
                    }

                    let printOp = webView.printOperation(with: printInfo)
                    printOp.showsPrintPanel = true
                    printOp.showsProgressPanel = true
                    printOp.runModal(for: self.parentWindow, delegate: nil, didRun: nil, contextInfo: nil)
                }
            }
        }

        let navDel = PrintNavDelegate(window: self.window, isReceipt: isReceipt, paperSize: normalizedPaperSize)
        pWebView.navigationDelegate = navDel
        objc_setAssociatedObject(pWebView, "navDelegate", navDel, .OBJC_ASSOCIATION_RETAIN)
        pWebView.loadHTMLString(html, baseURL: URL(string: "http://127.0.0.1:41738"))
    }

    // ─── Navigation Security & Isolation ─────────────────────
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if #available(macOS 11.3, *) {
            if navigationAction.shouldPerformDownload {
                decisionHandler(.download)
                return
            }
        }

        if url.scheme == "about" || url.scheme == "data" || url.scheme == "blob" {
            decisionHandler(.allow)
            return
        }

        let localPort = Int(localServer?.port ?? 41738)
        let isDevMode = CommandLine.arguments.contains("--dev")
        let isInternal = (url.host == "127.0.0.1" && url.port == localPort) ||
                         (isDevMode && url.host == "localhost" && url.port == 5173)

        if isInternal {
            decisionHandler(.allow)
        } else {
            // Never allow external websites to load inside the WKWebView holding the SQLite bridge
            print("[Security] Diverting external navigation to system browser: \(url.absoluteString)")
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    @available(macOS 11.3, *)
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    @available(macOS 11.3, *)
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            let localPort = Int(localServer?.port ?? 41738)
            let isDevMode = CommandLine.arguments.contains("--dev")
            let isInternal = (url.host == "127.0.0.1" && url.port == localPort) ||
                             (isDevMode && url.host == "localhost" && url.port == 5173)
            if !isInternal {
                NSWorkspace.shared.open(url)
                return nil
            }
        }
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = "Thông báo"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.runModal()
        completionHandler()
    }

    @available(macOS 27.0, *)
    func webView(_ webView: WKWebView, requestGeolocationPermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.prompt)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

extension AppDelegate: WKDownloadDelegate {
    @available(macOS 11.3, *)
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.isExtensionHidden = false
        panel.canCreateDirectories = true
        panel.prompt = "Lưu"
        if let fileType = UTType(filenameExtension: (suggestedFilename as NSString).pathExtension) {
            panel.allowedContentTypes = [fileType]
        }

        let finish: (NSApplication.ModalResponse) -> Void = { response in
            completionHandler(response == .OK ? panel.url : nil)
        }
        if let window = self.window {
            panel.beginSheetModal(for: window, completionHandler: finish)
        } else {
            panel.begin(completionHandler: finish)
        }
    }

    @available(macOS 11.3, *)
    func downloadDidFinish(_ download: WKDownload) {
        print("[Download] Finished download successfully")
    }

    @available(macOS 11.3, *)
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        print("[Download] Failed: \(error.localizedDescription)")
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
