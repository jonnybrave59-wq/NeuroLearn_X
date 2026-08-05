# NeuroLearn-X Full System 1.3.0

This package contains the complete NeuroLearn-X application:

- compiled installable PWA (`frontend/dist`)
- FastAPI backend and authentication APIs (`backend/app`)
- Alembic database migrations (`backend/alembic`)
- SQLite local database bootstrap and PostgreSQL production support
- Windows and Linux/macOS setup and launch scripts
- container deployment files

It is not a frontend-only demo. The frontend always calls the live backend by
relative `/api` routes when both are served from the same domain.

## Fastest Windows setup

1. Extract the ZIP completely.
2. Install Python 3.11 or newer if it is not already installed.
3. Double-click `Setup-NeuroLearn-X.bat` once. Internet access is needed while
   Python dependencies are installed.
4. Double-click `Start-NeuroLearn-X.bat` whenever you want to run the system.
5. Keep the server window open while using NeuroLearn-X.

The local application opens at `http://127.0.0.1:8021/#/`. The PWA and API are
served by the same FastAPI process, so no separate frontend server is required.

Demo accounts:

- Student: `STEM001` / `LearnX!2026`
- Teacher: `TEACHER01` / `NeuroTeach!2026`

These are synthetic demonstration accounts. Change passwords and production
secrets before handling real participant data.

## Linux/macOS setup

```bash
chmod +x Setup-NeuroLearn-X.sh Start-NeuroLearn-X.sh
./Setup-NeuroLearn-X.sh
./Start-NeuroLearn-X.sh
```

## Production deployment

Read `FULL-SYSTEM-SETUP.md`. A public deployment requires an HTTPS reverse
proxy, PostgreSQL, a strong `SECRET_KEY`, exact `ALLOWED_ORIGINS`, secure
cookies, and Alembic migrations. Do not use a static-only host.
