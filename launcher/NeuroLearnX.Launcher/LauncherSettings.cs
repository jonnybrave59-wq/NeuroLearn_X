using System.Text.Json;

namespace NeuroLearnX.Launcher;

internal sealed class LauncherSettings
{
    public int Width { get; set; } = 1180;
    public int Height { get; set; } = 780;

    private static string SettingsDirectory =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "NeuroLearn-X"
        );

    private static string SettingsPath =>
        Path.Combine(SettingsDirectory, "launcher-settings.json");

    public static LauncherSettings Load()
    {
        try
        {
            if (!File.Exists(SettingsPath))
            {
                return new LauncherSettings();
            }

            var settings = JsonSerializer.Deserialize<LauncherSettings>(
                File.ReadAllText(SettingsPath)
            ) ?? new LauncherSettings();
            settings.Width = Math.Clamp(settings.Width, 900, 2400);
            settings.Height = Math.Clamp(settings.Height, 640, 1600);
            return settings;
        }
        catch
        {
            return new LauncherSettings();
        }
    }

    public static void Save(Size size)
    {
        try
        {
            Directory.CreateDirectory(SettingsDirectory);
            var settings = new LauncherSettings
            {
                Width = Math.Clamp(size.Width, 900, 2400),
                Height = Math.Clamp(size.Height, 640, 1600),
            };
            File.WriteAllText(
                SettingsPath,
                JsonSerializer.Serialize(
                    settings,
                    new JsonSerializerOptions { WriteIndented = true }
                )
            );
        }
        catch
        {
            // Window-size persistence is optional and must never block the launcher.
        }
    }
}
