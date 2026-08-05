using System.Diagnostics;
using System.Runtime.InteropServices;

namespace NeuroLearnX.Launcher;

internal static class Program
{
    private const string MutexName = @"Local\NeuroLearnX.Launcher";

    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        LauncherConfig config;
        try
        {
            var configPath = Path.Combine(AppContext.BaseDirectory, "launcher-config.json");
            config = LauncherConfig.Load(configPath);
        }
        catch (Exception error)
        {
            MessageBox.Show(
                error.Message,
                "NeuroLearn-X launcher",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning
            );
            return 1;
        }

        if (args.Any(value =>
                string.Equals(value, "--self-test", StringComparison.OrdinalIgnoreCase)))
        {
            return config.ProductionUri.Scheme == Uri.UriSchemeHttps ? 0 : 1;
        }

        using var mutex = new Mutex(true, MutexName, out var isFirstInstance);
        if (!isFirstInstance)
        {
            NativeMethods.FocusExistingWindow();
            return 0;
        }

        Application.Run(new MainForm(config));
        return 0;
    }
}

internal static class NativeMethods
{
    private const int RestoreWindow = 9;

    [DllImport("user32.dll", EntryPoint = "FindWindowW", CharSet = CharSet.Unicode)]
    private static extern nint FindWindow(string? className, string windowName);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ShowWindow(nint windowHandle, int command);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(nint windowHandle);

    public static void FocusExistingWindow()
    {
        var handle = FindWindow(null, "NeuroLearn-X");
        if (handle == nint.Zero)
        {
            return;
        }

        ShowWindow(handle, RestoreWindow);
        SetForegroundWindow(handle);
    }

    public static void OpenDefaultBrowser(Uri uri)
    {
        Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
    }
}
