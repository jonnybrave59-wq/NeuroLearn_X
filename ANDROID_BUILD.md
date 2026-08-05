# Build the NeuroLearn-X Android APK

The Capacitor 8 project is in `frontend/android`. It keeps the existing React
UI, uses package `com.hnchs.neurolearnx`, disables cleartext HTTP and Android
backups, requests Internet access, supports the hardware back button, and opens
external links through the system browser.

The APK bundles the compiled frontend. At build time,
`VITE_API_BASE_URL` must be the deployed Render HTTPS origin. It must never be
localhost, a LAN address, or HTTP. The web app still uses relative `/api` when
opened in a browser; only the separately bundled native client receives the
explicit cloud origin.

## GitHub Actions debug APK

1. Deploy Render and confirm `https://<service>.onrender.com/api/health/ready`.
2. Push the source to GitHub.
3. In **Settings → Secrets and variables → Actions → Variables**, set:

   `NEUROLEARNX_PUBLIC_URL=https://<service>.onrender.com`

4. Run **Actions → Build NeuroLearn-X Android APK → Run workflow**.
5. Download the `NeuroLearn-X-Android-debug` artifact.
6. Extract `NeuroLearn-X.apk` and verify `NeuroLearn-X.apk.sha256`.

The workflow refuses non-HTTPS backend values. It runs frontend tests and the
production build, synchronizes Capacitor, runs Android unit tests and lint,
builds the debug-signed APK, verifies the signature, package ID, and Internet
permission, then gives the APK the required name.

## Optional signed release APK

Add all four encrypted GitHub Actions secrets to enable a signed release build:

- `ANDROID_KEYSTORE_BASE64`: base64-encoded `.jks` keystore.
- `ANDROID_KEYSTORE_PASSWORD`.
- `ANDROID_KEY_ALIAS`.
- `ANDROID_KEY_PASSWORD`.

The workflow fails if only some signing values are configured. With all four,
it also uploads `NeuroLearn-X-Android-release`, containing
`NeuroLearn-X-release.apk` and its checksum. Never commit the keystore or its
passwords.

## Local build

Requirements: Node.js 24, JDK 21, Android Studio/SDK 36, and network access for
the first Gradle dependency download.

```powershell
cd frontend
$env:VITE_PUBLIC_APP_URL = "https://<service>.onrender.com"
$env:VITE_API_BASE_URL = "https://<service>.onrender.com"
$env:VITE_APK_AVAILABLE = "false"
npm ci
npm test
npm run cap:sync
cd android
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug
```

The debug APK is
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to
`release/NeuroLearn-X.apk`, calculate its SHA-256 checksum, install it on a
physical Android device, and verify student/teacher sign-in, session persistence,
file selection/upload, dashboards, assessment submission, pathways, and error
messages before publishing it.

For a local signed release, set `ANDROID_KEYSTORE_PATH`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`,
then run `gradlew.bat assembleRelease`. The release build is only valid when
Android's `apksigner verify` succeeds.

## Backend settings required by the APK

The default `render.yaml` already sets:

```text
COOKIE_SECURE=1
COOKIE_SAMESITE=none
CAPACITOR_ORIGINS=https://localhost
```

`https://localhost` is Capacitor's protected WebView origin; it is not an API
address. The native bundle sends credentialed requests only to the configured
Render HTTPS origin. The backend returns exact credentialed CORS headers for
that one origin and keeps the session cookie HTTP-only and secure.
