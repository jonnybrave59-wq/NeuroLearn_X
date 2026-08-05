using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace NeuroLearnX.Launcher;

internal sealed class MainForm : Form
{
    private static readonly Color Navy = Color.FromArgb(7, 27, 52);
    private static readonly Color Cyan = Color.FromArgb(34, 211, 238);

    private readonly LauncherConfig _config;
    private readonly WebView2 _webView = new() { Dock = DockStyle.Fill, Visible = false };
    private readonly Panel _statusPanel = new() { Dock = DockStyle.Fill, BackColor = Color.White };
    private readonly Label _statusTitle = new()
    {
        AutoSize = false,
        Font = new Font("Segoe UI", 19, FontStyle.Bold),
        ForeColor = Navy,
        Height = 42,
        TextAlign = ContentAlignment.MiddleCenter,
    };
    private readonly Label _statusMessage = new()
    {
        AutoSize = false,
        Font = new Font("Segoe UI", 10.5f),
        ForeColor = Color.FromArgb(71, 85, 105),
        Height = 54,
        TextAlign = ContentAlignment.TopCenter,
    };
    private readonly Button _retryButton = new()
    {
        Text = "Try Again",
        BackColor = Cyan,
        ForeColor = Navy,
        FlatStyle = FlatStyle.Flat,
        Font = new Font("Segoe UI", 10, FontStyle.Bold),
        Size = new Size(140, 42),
        Visible = false,
    };
    private readonly Button _browserButton = new()
    {
        Text = "Open in Browser",
        BackColor = Color.White,
        ForeColor = Navy,
        FlatStyle = FlatStyle.Flat,
        Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
        Size = new Size(150, 38),
    };
    private bool _webViewReady;
    private bool _isConnecting;

    public MainForm(LauncherConfig config)
    {
        _config = config;
        var settings = LauncherSettings.Load();

        Text = "NeuroLearn-X";
        Size = new Size(settings.Width, settings.Height);
        MinimumSize = new Size(900, 640);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.White;

        var iconPath = Path.Combine(
            AppContext.BaseDirectory,
            "icons",
            "neurolearnx.ico"
        );
        if (File.Exists(iconPath))
        {
            Icon = new Icon(iconPath);
        }

        Controls.Add(BuildContent());
        Shown += async (_, _) => await ConnectAsync();
        FormClosing += (_, _) =>
        {
            if (WindowState == FormWindowState.Normal)
            {
                LauncherSettings.Save(Size);
            }
            _webView.CoreWebView2?.Stop();
            _webView.Dispose();
        };
    }

    private Control BuildContent()
    {
        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            RowCount = 2,
            ColumnCount = 1,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
        };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 66));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var header = new Panel { Dock = DockStyle.Fill, BackColor = Navy };
        var appName = new Label
        {
            Text = "NeuroLearn-X",
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 18, FontStyle.Bold),
            AutoSize = true,
            Location = new Point(24, 17),
        };
        var version = new Label
        {
            Text = $"Secure online launcher - v{_config.Version}",
            ForeColor = Color.FromArgb(203, 213, 225),
            Font = new Font("Segoe UI", 8.5f),
            AutoSize = true,
            Location = new Point(190, 24),
        };
        _browserButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        _browserButton.Location = new Point(Width - 186, 14);
        _browserButton.Click += (_, _) => NativeMethods.OpenDefaultBrowser(_config.ProductionUri);
        header.Resize += (_, _) => _browserButton.Left = header.ClientSize.Width - 174;
        header.Controls.Add(appName);
        header.Controls.Add(version);
        header.Controls.Add(_browserButton);

        var content = new Panel { Dock = DockStyle.Fill };
        BuildStatusPanel();
        content.Controls.Add(_webView);
        content.Controls.Add(_statusPanel);

        root.Controls.Add(header, 0, 0);
        root.Controls.Add(content, 0, 1);
        return root;
    }

    private void BuildStatusPanel()
    {
        var card = new Panel
        {
            Size = new Size(560, 360),
            BackColor = Color.White,
            Anchor = AnchorStyles.None,
        };
        _statusPanel.Controls.Add(card);
        _statusPanel.Resize += (_, _) =>
        {
            card.Left = Math.Max(0, (_statusPanel.ClientSize.Width - card.Width) / 2);
            card.Top = Math.Max(0, (_statusPanel.ClientSize.Height - card.Height) / 2);
        };

        var logoPath = Path.Combine(
            AppContext.BaseDirectory,
            "icons",
            "icon-192.png"
        );
        var logo = new PictureBox
        {
            Size = new Size(112, 112),
            Location = new Point(224, 18),
            SizeMode = PictureBoxSizeMode.Zoom,
        };
        if (File.Exists(logoPath))
        {
            logo.Image = Image.FromFile(logoPath);
        }

        _statusTitle.Location = new Point(30, 144);
        _statusTitle.Width = 500;
        _statusMessage.Location = new Point(45, 195);
        _statusMessage.Width = 470;
        _retryButton.Location = new Point(123, 276);
        _retryButton.FlatAppearance.BorderSize = 0;
        _retryButton.Click += async (_, _) => await ConnectAsync();

        var browserFallback = new Button
        {
            Text = "Open in Browser",
            BackColor = Color.White,
            ForeColor = Navy,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 10, FontStyle.Bold),
            Size = new Size(170, 42),
            Location = new Point(278, 276),
        };
        browserFallback.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
        browserFallback.Click += (_, _) =>
            NativeMethods.OpenDefaultBrowser(_config.ProductionUri);

        card.Controls.Add(logo);
        card.Controls.Add(_statusTitle);
        card.Controls.Add(_statusMessage);
        card.Controls.Add(_retryButton);
        card.Controls.Add(browserFallback);
    }

    private async Task ConnectAsync()
    {
        if (_isConnecting)
        {
            return;
        }

        _isConnecting = true;
        ShowStatus(
            "Connecting to NeuroLearn-X",
            "Checking the secure learning server...",
            allowRetry: false
        );

        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(12) };
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                new Uri(_config.ProductionUri, "api/health/ready")
            );
            request.Headers.UserAgent.ParseAdd("NeuroLearn-X-Windows-Launcher/1.1");
            using var response = await http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException(
                    $"The server returned status {(int)response.StatusCode}."
                );
            }

            await EnsureWebViewAsync();
            _webView.Visible = true;
            _statusPanel.Visible = false;
            _webView.Source = _config.ProductionUri;
        }
        catch (Exception error)
        {
            ShowStatus(
                "NeuroLearn-X is offline",
                $"The secure server could not be reached. Check your internet connection and try again.\n\n{FriendlyError(error)}",
                allowRetry: true
            );
        }
        finally
        {
            _isConnecting = false;
        }
    }

    private async Task EnsureWebViewAsync()
    {
        if (_webViewReady)
        {
            return;
        }

        var userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "NeuroLearn-X",
            "WebView2"
        );
        var environment = await CoreWebView2Environment.CreateAsync(
            userDataFolder: userDataFolder
        );
        await _webView.EnsureCoreWebView2Async(environment);

        _webView.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
        _webView.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;
        _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
        _webView.CoreWebView2.NewWindowRequested += (_, eventArgs) =>
        {
            eventArgs.Handled = true;
            if (TrySafeHttpsUri(eventArgs.Uri, out var external))
            {
                NativeMethods.OpenDefaultBrowser(external);
            }
        };
        _webView.NavigationStarting += (_, eventArgs) =>
        {
            if (!TrySafeHttpsUri(eventArgs.Uri, out var destination))
            {
                eventArgs.Cancel = true;
                return;
            }

            if (!string.Equals(
                    destination.GetLeftPart(UriPartial.Authority),
                    _config.ProductionUri.GetLeftPart(UriPartial.Authority),
                    StringComparison.OrdinalIgnoreCase))
            {
                eventArgs.Cancel = true;
                NativeMethods.OpenDefaultBrowser(destination);
            }
        };
        _webView.NavigationCompleted += (_, eventArgs) =>
        {
            if (!eventArgs.IsSuccess)
            {
                _webView.Visible = false;
                ShowStatus(
                    "NeuroLearn-X is offline",
                    "The application could not finish loading. Check your connection, then try again.",
                    allowRetry: true
                );
            }
        };
        _webView.CoreWebView2.ProcessFailed += (_, _) =>
        {
            _webView.Visible = false;
            ShowStatus(
                "The application window stopped",
                "Try reconnecting, or use Open in Browser.",
                allowRetry: true
            );
        };
        _webViewReady = true;
    }

    private static bool TrySafeHttpsUri(string value, out Uri uri)
    {
        return Uri.TryCreate(value, UriKind.Absolute, out uri!)
            && string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrEmpty(uri.UserInfo);
    }

    private void ShowStatus(string title, string message, bool allowRetry)
    {
        _statusTitle.Text = title;
        _statusMessage.Text = message;
        _retryButton.Visible = allowRetry;
        _statusPanel.Visible = true;
        _statusPanel.BringToFront();
    }

    private static string FriendlyError(Exception error)
    {
        if (error is FileNotFoundException
            || error.Message.Contains("WebView2", StringComparison.OrdinalIgnoreCase))
        {
            return "Microsoft Edge WebView2 Runtime may be unavailable. Use Open in Browser.";
        }
        return "No passwords or private learner information were sent by the launcher.";
    }
}
