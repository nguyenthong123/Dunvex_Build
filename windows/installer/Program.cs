using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Win32;

namespace DunvexInstaller;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        if (args.Contains("--uninstall", StringComparer.OrdinalIgnoreCase))
        {
            Installer.Uninstall();
            return;
        }

        Application.Run(new InstallerForm());
    }
}

internal sealed class InstallerForm : Form
{
    private readonly Label _status;
    private readonly Button _installButton;
    private readonly CheckBox _desktopShortcut;

    public InstallerForm()
    {
        Text = "Cài đặt Dunvex Build";
        Width = 480;
        Height = 260;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application;

        var title = new Label
        {
            Text = "Dunvex Build",
            Font = new Font("Segoe UI", 18, FontStyle.Bold),
            AutoSize = true,
            Location = new Point(28, 24)
        };
        var description = new Label
        {
            Text = "Cài ứng dụng vào tài khoản Windows hiện tại. Lối tắt sẽ được thêm vào Start Menu.",
            AutoSize = false,
            Size = new Size(410, 48),
            Location = new Point(30, 70)
        };
        _desktopShortcut = new CheckBox
        {
            Text = "Tạo thêm lối tắt trên Desktop",
            Checked = true,
            AutoSize = true,
            Location = new Point(30, 130)
        };
        _status = new Label
        {
            Text = "Ứng dụng sẽ được cài riêng cho người dùng hiện tại.",
            AutoSize = false,
            Size = new Size(410, 24),
            Location = new Point(30, 164)
        };
        _installButton = new Button
        {
            Text = "Cài đặt",
            Size = new Size(120, 36),
            Location = new Point(320, 192),
            UseVisualStyleBackColor = true
        };
        _installButton.Click += InstallButton_Click;

        Controls.AddRange([title, description, _desktopShortcut, _status, _installButton]);
        AcceptButton = _installButton;
    }

    private async void InstallButton_Click(object? sender, EventArgs e)
    {
        _installButton.Enabled = false;
        _desktopShortcut.Enabled = false;
        _status.Text = "Đang cài đặt Dunvex...";
        try
        {
            await Installer.InstallAsync(_desktopShortcut.Checked);
            _status.Text = "Cài đặt hoàn tất. Đang mở Dunvex...";
            Process.Start(new ProcessStartInfo(Installer.AppExecutablePath) { UseShellExecute = true });
            Close();
        }
        catch (Exception ex)
        {
            _status.Text = "Cài đặt không thành công.";
            MessageBox.Show(this, ex.Message, "Cài đặt Dunvex", MessageBoxButtons.OK, MessageBoxIcon.Error);
            _installButton.Enabled = true;
            _desktopShortcut.Enabled = true;
        }
    }
}

internal static class Installer
{
    private const string ProductName = "Dunvex Build";
    private const string UninstallShortcutFileName = "Uninstall Dunvex.lnk";
    private const string LegacyUninstallShortcutFileName = "Gỡ cài đặt Dunvex.lnk";
    private const string UninstallKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\DunvexBuild";
    private static readonly string ProgramsDir = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
    private static readonly string StartMenuDir = Path.Combine(ProgramsDir, ProductName);
    private static readonly string DesktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
    private static readonly string InstallDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Programs",
        "Dunvex Build");

    public static string AppExecutablePath => Path.Combine(InstallDir, "Dunvex.exe");

    public static async Task InstallAsync(bool createDesktopShortcut)
    {
        if (IsRunningFromInstallDirectory())
        {
            throw new InvalidOperationException("Hãy đóng Dunvex đang chạy rồi mở lại file cài đặt từ thư mục Tải xuống.");
        }

        string installParent = Path.GetDirectoryName(InstallDir)!;
        Directory.CreateDirectory(installParent);
        string stagingDir = Path.Combine(installParent, $".DunvexInstall-{Guid.NewGuid():N}");
        Directory.CreateDirectory(stagingDir);
        try
        {
            await Task.Run(() => ExtractPayload(stagingDir));
            if (Directory.Exists(InstallDir))
            {
                Directory.Delete(InstallDir, recursive: true);
            }
            Directory.CreateDirectory(Path.GetDirectoryName(InstallDir)!);
            Directory.Move(stagingDir, InstallDir);

            string setupSource = Application.ExecutablePath;
            string setupTarget = Path.Combine(InstallDir, "Dunvex-Setup.exe");
            if (!string.Equals(Path.GetFullPath(setupSource), Path.GetFullPath(setupTarget), StringComparison.OrdinalIgnoreCase))
            {
                File.Copy(setupSource, setupTarget, overwrite: true);
            }

            Directory.CreateDirectory(StartMenuDir);
            TryDeleteShortcut(Path.Combine(StartMenuDir, LegacyUninstallShortcutFileName));
            CreateShortcut(Path.Combine(StartMenuDir, "Dunvex Build.lnk"), AppExecutablePath, InstallDir, AppExecutablePath);
            CreateShortcut(
                Path.Combine(StartMenuDir, UninstallShortcutFileName),
                setupTarget,
                InstallDir,
                setupTarget,
                "--uninstall");
            if (createDesktopShortcut)
            {
                CreateShortcut(Path.Combine(DesktopDir, "Dunvex Build.lnk"), AppExecutablePath, InstallDir, AppExecutablePath);
            }

            using RegistryKey key = Registry.CurrentUser.CreateSubKey(UninstallKeyPath)
                ?? throw new InvalidOperationException("Không thể đăng ký ứng dụng trong danh sách Apps & Features.");
            key.SetValue("DisplayName", ProductName);
            key.SetValue("DisplayVersion", Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.1");
            key.SetValue("Publisher", "Dunvex");
            key.SetValue("InstallLocation", InstallDir);
            key.SetValue("DisplayIcon", AppExecutablePath);
            key.SetValue("UninstallString", $"\"{setupTarget}\" --uninstall");
            key.SetValue("NoModify", 1, RegistryValueKind.DWord);
            key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        }
        finally
        {
            if (Directory.Exists(stagingDir))
            {
                Directory.Delete(stagingDir, recursive: true);
            }
        }
    }

    public static void Uninstall()
    {
        if (MessageBox.Show(
            "Bạn có chắc muốn gỡ Dunvex Build khỏi máy này không?",
            "Gỡ cài đặt Dunvex",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question) != DialogResult.Yes)
        {
            return;
        }

        TryDeleteShortcut(Path.Combine(StartMenuDir, "Dunvex Build.lnk"));
        TryDeleteShortcut(Path.Combine(StartMenuDir, UninstallShortcutFileName));
        TryDeleteShortcut(Path.Combine(StartMenuDir, LegacyUninstallShortcutFileName));
        TryDeleteDirectory(StartMenuDir);
        TryDeleteShortcut(Path.Combine(DesktopDir, "Dunvex Build.lnk"));
        Registry.CurrentUser.DeleteSubKeyTree(UninstallKeyPath, throwOnMissingSubKey: false);

        string scriptPath = Path.Combine(Path.GetTempPath(), $"DunvexUninstall-{Guid.NewGuid():N}.cmd");
        string escapedInstallDir = InstallDir.Replace("\"", "\"\"");
        File.WriteAllText(scriptPath,
            $"@echo off\r\n" +
            $"for /l %%i in (1,1,30) do (\r\n" +
            $"  rmdir /s /q \"{escapedInstallDir}\" 2>nul\r\n" +
            $"  if not exist \"{escapedInstallDir}\" goto done\r\n" +
            $"  timeout /t 1 /nobreak >nul\r\n" +
            $")\r\n" +
            $":done\r\n" +
            $"del \"%~f0\"\r\n");
        var startInfo = new ProcessStartInfo("cmd.exe")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };
        startInfo.ArgumentList.Add("/c");
        startInfo.ArgumentList.Add(scriptPath);
        Process.Start(startInfo);
    }

    private static bool IsRunningFromInstallDirectory()
    {
        string current = Path.GetFullPath(Application.ExecutablePath);
        string installPrefix = Path.GetFullPath(InstallDir) + Path.DirectorySeparatorChar;
        return current.StartsWith(installPrefix, StringComparison.OrdinalIgnoreCase);
    }

    private static void ExtractPayload(string destination)
    {
        using Stream payload = Assembly.GetExecutingAssembly().GetManifestResourceStream("DunvexPayload.zip")
            ?? throw new InvalidOperationException("Không tìm thấy gói ứng dụng bên trong bộ cài.");
        using var archive = new ZipArchive(payload, ZipArchiveMode.Read);
        string destinationRoot = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
        foreach (ZipArchiveEntry entry in archive.Entries)
        {
            string outputPath = Path.GetFullPath(Path.Combine(destination, entry.FullName));
            if (!outputPath.StartsWith(destinationRoot, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException("Gói cài đặt chứa đường dẫn tệp không hợp lệ.");
            }

            if (string.IsNullOrEmpty(entry.Name))
            {
                Directory.CreateDirectory(outputPath);
                continue;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
            entry.ExtractToFile(outputPath, overwrite: true);
        }

        if (!File.Exists(Path.Combine(destination, "Dunvex.exe")))
        {
            throw new InvalidDataException("Gói cài đặt bị lỗi: không tìm thấy Dunvex.exe.");
        }
    }

    private static void CreateShortcut(string shortcutPath, string targetPath, string workingDirectory, string iconPath, string? arguments = null)
    {
        Type shellType = Type.GetTypeFromProgID("WScript.Shell")
            ?? throw new InvalidOperationException("Windows Script Host không khả dụng để tạo lối tắt.");
        object shellObject = Activator.CreateInstance(shellType)
            ?? throw new InvalidOperationException("Không thể khởi tạo Windows Script Host.");
        object? shortcutObject = null;
        try
        {
            dynamic shell = shellObject;
            shortcutObject = shell.CreateShortcut(shortcutPath);
            dynamic shortcut = shortcutObject;
            shortcut.TargetPath = targetPath;
            shortcut.WorkingDirectory = workingDirectory;
            shortcut.IconLocation = $"{iconPath},0";
            if (arguments is not null)
            {
                shortcut.Arguments = arguments;
            }
            shortcut.Save();
        }
        finally
        {
            if (shortcutObject is not null && Marshal.IsComObject(shortcutObject))
            {
                Marshal.FinalReleaseComObject(shortcutObject);
            }
            if (Marshal.IsComObject(shellObject))
            {
                Marshal.FinalReleaseComObject(shellObject);
            }
        }
    }

    private static void TryDeleteShortcut(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch { }
    }

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
        }
        catch { }
    }
}
