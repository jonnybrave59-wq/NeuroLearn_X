# NeuroLearn-X HTML App 1.3.1

This package launches the existing compiled NeuroLearn-X HTML/PWA directly
while preserving the complete NeuroLearn-X architecture.

NeuroLearn-X cannot safely operate as one disconnected HTML file: Student and
Teacher accounts, assessment attempts, mastery records, intelligent pathways,
and research audit data require the included backend and database. The package
therefore serves the compiled production `frontend/dist/index.html` directly
from `/` using the same FastAPI process that serves relative `/api` routes.
There is no intermediate page, iframe, Open button, Retry button, or redirect
page.

## Windows: fastest start

1. Extract the ZIP completely.
2. Double-click `Start-NeuroLearn-X-HTML-App.bat`.
3. On the first run, allow the dependency installation to finish.
4. The launcher applies all Alembic database migrations, starts FastAPI, and
   opens the real NeuroLearn-X system automatically.
5. Keep the server window open while using the app.

The application opens at `http://127.0.0.1:8021/#/`.

## Linux or macOS

```bash
chmod +x Setup-NeuroLearn-X.sh Start-NeuroLearn-X.sh Start-NeuroLearn-X-HTML-App.sh
./Start-NeuroLearn-X-HTML-App.sh
```

## Demo accounts

- Student: `STEM001` / `LearnX!2026`
- Teacher: `TEACHER01` / `NeuroTeach!2026`

These accounts and the bundled records are synthetic demonstrations.

## Install on a phone or computer

For browser installation on Android, Windows, iPhone, or iPad, deploy the whole
package to one HTTPS domain using the instructions in `FULL-SYSTEM-SETUP.md`.
Open that HTTPS address and use the browser's Install or Add to Home Screen
control. The production HTML uses relative `/api` routes and contains no
localhost backend URL.

A phone cannot run the Python backend by opening an HTML file from Downloads.
It must use a deployed HTTPS instance or connect to a server running on another
device. This is required to preserve secure logins and database saving.

## Application entry points

- Browser URL: `http://127.0.0.1:8021/#/`
- Production application: `frontend/dist/index.html`, served directly from `/`
- API health check: `/api/health`
- One-click Windows launcher: `Start-NeuroLearn-X-HTML-App.bat`

The package is full-stack and is not a frontend-only HTML demonstration.
