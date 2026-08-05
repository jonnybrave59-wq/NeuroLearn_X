using System.Text.Json;
using System.Text.Json.Serialization;

namespace NeuroLearnX.Launcher;

internal sealed class LauncherConfig
{
    private static readonly string[] PlaceholderMarkers =
    [
        "your-final",
        "your-app",
        "placeholder",
        "example.com",
        ".invalid",
        "localhost",
        "127.0.0.1",
        "<",
        ">",
    ];

    [JsonPropertyName("appName")]
    public string AppName { get; init; } = "";

    [JsonPropertyName("productionUrl")]
    public string ProductionUrl { get; init; } = "";

    [JsonPropertyName("version")]
    public string Version { get; init; } = "";

    [JsonIgnore]
    public Uri ProductionUri { get; private set; } = null!;

    public static LauncherConfig Load(string path)
    {
        if (!File.Exists(path))
        {
            throw new InvalidOperationException(
                "launcher-config.json is missing. Use Open NeuroLearn-X.bat as a fallback."
            );
        }

        var config = JsonSerializer.Deserialize<LauncherConfig>(
            File.ReadAllText(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
        ) ?? throw new InvalidOperationException("launcher-config.json is invalid.");

        config.Validate();
        return config;
    }

    private void Validate()
    {
        if (string.IsNullOrWhiteSpace(AppName) || string.IsNullOrWhiteSpace(Version))
        {
            throw new InvalidOperationException("Launcher name and version are required.");
        }

        var candidate = ProductionUrl.Trim();
        if (PlaceholderMarkers.Any(marker =>
                candidate.Contains(marker, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException(
                "The public NeuroLearn-X URL has not been configured."
            );
        }

        if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)
            || !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(uri.Host)
            || !string.IsNullOrEmpty(uri.UserInfo)
            || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment)
            || (uri.AbsolutePath != "/" && uri.AbsolutePath != ""))
        {
            throw new InvalidOperationException(
                "The configured NeuroLearn-X URL must be a clean HTTPS origin."
            );
        }

        ProductionUri = new Uri(candidate.TrimEnd('/') + "/", UriKind.Absolute);
    }
}
