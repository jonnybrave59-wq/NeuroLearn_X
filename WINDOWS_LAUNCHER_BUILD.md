# Build and download the NeuroLearn-X Windows package

The final Windows package is intentionally built on a clean GitHub-hosted
Windows runner. The workflow refuses placeholder, local, non-HTTPS, credential-
bearing, query-string, or fragment URLs.

## Before running the workflow

1. Deploy NeuroLearn-X to its permanent Vercel HTTPS URL.
2. Verify:
   - `https://<deployment>/api/ready`
   - `https://<deployment>/#/`
3. Push this complete source project to GitHub.

## Run the workflow

1. Open the GitHub repository.
2. Select **Actions**.
3. Select **Build NeuroLearn-X Windows Shareable Package**.
4. Select **Run workflow**.
5. Enter:
   - the exact permanent HTTPS deployment URL;
   - the official researcher contact line;
   - the version and release date.
6. Select **Run workflow** and wait for every check to pass.

The workflow builds a self-contained `win-x64` executable, runs its config
self-test, checks the public server, generates the PDF and QR code, scans the
package for private files and participant codes, verifies every checksum, and
uploads two artifacts.

## Download

1. Open the completed workflow run.
2. Scroll to **Artifacts**.
3. Download **NeuroLearn-X-Shareable** for the complete ZIP.
4. Optionally download **Open-NeuroLearn-X-Windows** for the EXE and its
   adjacent launcher configuration.
5. Extract the downloaded GitHub artifact ZIP. The requested distributable is
   `NeuroLearn-X-Shareable.zip`.

## Final physical-computer check

On a second Windows 10 or Windows 11 computer:

1. Verify the ZIP came from the official researchers.
2. Extract all files.
3. Double-click `Open NeuroLearn-X.exe`.
4. Confirm Student Mode and Teacher Mode appear.
5. Close the launcher and confirm no launcher window remains.
6. Reopen it, resize the window, close it, and verify that the size is
   remembered.
7. Temporarily disconnect the internet and verify the offline message, **Try
   Again**, and **Open in Browser** controls.

The executable is not code-signed by this project. Windows SmartScreen may
therefore show an unrecognized-publisher warning. Public distribution should
use an organization-controlled code-signing certificate when one is available.
