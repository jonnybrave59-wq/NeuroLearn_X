# NeuroLearn-X Windows launcher

The launcher is a portable .NET 8 Windows Forms application that embeds the
public HTTPS NeuroLearn-X deployment with Microsoft Edge WebView2. It uses no
administrator privileges and stores only window dimensions and WebView2 browser
data under the current user's local application-data folder.

`launcher-config.json` intentionally contains a placeholder. Packaging must fail
until a real HTTPS deployment URL is supplied. The production workflow stages a
validated config beside the executable; no password, token, database URL, or
secret is embedded.

## Build locally on Windows

1. Install the .NET 8 SDK and Microsoft Edge WebView2 Runtime.
2. Publish the launcher:

   ```powershell
   dotnet publish .\launcher\NeuroLearnX.Launcher\NeuroLearnX.Launcher.csproj `
     -c Release -r win-x64 --self-contained true `
     -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true `
     -p:DebugType=None -o .\launcher\build\win-x64
   ```

3. Run the package builder with the real public URL and public researcher
   contact:

   ```powershell
   .\.venv\Scripts\python.exe .\scripts\build_shareable_package.py `
     --production-url "https://your-real-app.replit.app" `
     --exe ".\launcher\build\win-x64\Open NeuroLearn-X.exe" `
     --contact "Research Team - research@example.edu"
   ```

The GitHub Actions workflow performs these steps on a clean Windows runner and
uploads the EXE and ZIP as workflow artifacts.
