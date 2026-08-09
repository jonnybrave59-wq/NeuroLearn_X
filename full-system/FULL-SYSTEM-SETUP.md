# NeuroLearn-X Full-System Setup and Deployment

## Package architecture

FastAPI serves the compiled React PWA at `/` and all application services at
`/api`. Authentication, assessment scoring, mastery, intelligent pathways,
misconception evidence, teacher workflows, and persistence remain server-side.

The browser build contains no fixed development origin. Same-origin requests
use `/api` and `/api/health`. `VITE_API_BASE_URL` is only needed when building a
separate client, and then it must be the public HTTPS backend origin.

## Local database

The setup scripts create `backend/neurolearnx.db`, apply all Alembic migrations,
and seed synthetic demo accounts. SQLite is suitable for a local demonstration
or a single-computer research prototype. Copy this database while the server is
stopped to make a backup.

To reset only a disposable demo installation, stop the server, remove the local
database, and run the setup script again. Never remove a database containing
research data without an approved retention and backup procedure.

## PostgreSQL production database

Set `DATABASE_URL` to a persistent PostgreSQL connection supplied by the host,
for example:

```text
postgresql+psycopg://USER:PASSWORD@db:5432/neurolearnx
```

Run migrations before every production start:

```bash
cd backend
python -m alembic upgrade head
```

Import the preserved SQLite dataset into a new empty PostgreSQL database before
the first public start. Do not seed or replace production research records.
The guarded copier is included in `scripts/migrate_sqlite_to_postgres.py`.

Synthetic demo data may be seeded only for a separate disposable deployment:

```bash
python -m app.seed
```

Set `SEED_DEMO_ON_STARTUP=0` after the initial seed. The seed accounts and
metrics are demonstrations, not research findings.

## Required production environment

Copy `.env.production.example` into the deployment secret manager and replace
every placeholder. Do not put real secrets in the ZIP or source control.

- `APP_ENV=production`
- `DATABASE_URL`: persistent PostgreSQL URL
- `SECRET_KEY`: random value of at least 32 characters
- `PRODUCTION_TEACHER_PASSWORD`: strong provider-managed teacher secret
- `PRODUCTION_DEMO_STUDENT_PASSWORD`: separate strong demo-student secret
- `COOKIE_SECURE=1`
- `COOKIE_SAMESITE=lax` for the bundled same-origin web deployment
- `PUBLIC_APP_URL`: final clean HTTPS application origin
- `ALLOWED_ORIGINS`: exact approved HTTPS frontend origins
- `CREATE_TABLES_ON_STARTUP=0`
- `SEED_DEMO_IF_EMPTY=0` and `SEED_DEMO_ON_STARTUP=0`

Question Studio requires `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, and an HTTPS
`AI_BASE_URL`. Store the credential only in the deployment secret manager.

Use `COOKIE_SAMESITE=none` only when an explicitly approved cross-origin client
is enabled. Credentialed CORS never uses `*`.

## Container deployment

The included `Dockerfile` uses the already-built PWA and installs the backend.
It runs deployment validation, applies migrations, optionally seeds demo data,
and launches Uvicorn on the host-provided `PORT`.

```bash
docker build -t neurolearn-x .
docker run --env-file .env.production -p 8000:8000 neurolearn-x
```

Production traffic must arrive through an HTTPS reverse proxy that forwards the
original scheme and host. Health endpoints are:

- `/api/health`
- `/api/health/live`
- `/api/health/ready`

## PWA installation

Installation requires HTTPS except for browser-recognized loopback development
origins.

- Android: Chrome menu → Install app
- Windows: Chrome or Edge address-bar install button
- iPhone/iPad: Safari → Share → Add to Home Screen

The service worker precaches only safe application-shell files. `/api` routes,
authentication, assessments, pathways, uploads, and student/teacher records are
network-only and are never stored by the service worker.

## Verification checklist

1. Confirm `/api/health` reports `NeuroLearn-X API` and version `1.3.1`.
2. Sign in as Student and Teacher.
3. Open an assessment and save a response with a mental-effort rating.
4. Confirm mastery and the intelligent pathway update.
5. Restart the server and confirm the saved records remain.
6. Install the PWA and confirm the application shell opens after restart.
7. Test the final HTTPS deployment from a second device.
