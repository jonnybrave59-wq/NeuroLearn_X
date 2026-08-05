# NeuroLearn-X Render deployment

NeuroLearn-X deploys as one Docker web service plus Render PostgreSQL. FastAPI
serves the compiled React PWA directly from `/`; API routes remain under `/api`.
There is no second frontend host, launcher page, iframe, or redirect layer.

## Deploy the Blueprint

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In Render, choose **New → Blueprint**, connect the repository, and select the
   root `render.yaml`.
3. Review the two resources before applying:

   - `neurolearn-x`: Docker web service in Singapore.
   - `neurolearn-x-postgres`: PostgreSQL 18 in the same region.

4. Apply the Blueprint and wait for `/api/health/ready` to pass.
5. Open the assigned `https://<service>.onrender.com/` URL. The real homepage
   must appear immediately.

The Blueprint generates `SECRET_KEY`, injects PostgreSQL's private connection
string, enables secure cookies, approves the exact Capacitor WebView origin,
runs Alembic on every container start, and seeds demo records only when the
database has no users. It never puts database credentials or secrets in the
frontend or APK.

The bundled Blueprint uses Render's free plans so it can be created without an
automatic paid commitment. For a time-critical research defense, upgrade the
web service and database to paid always-on plans after reviewing Render's
current pricing, backup, retention, and recovery options.

## Runtime commands

Render builds with the root `Dockerfile`. The image runs:

```text
python /app/scripts/validate_deployment.py
python -m alembic upgrade head
python -m app.seed_if_empty
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips=*
```

The frontend production build intentionally leaves `VITE_API_BASE_URL` empty,
so browser requests use same-origin `/api` and `/api/health`. Render supplies
`RENDER_EXTERNAL_HOSTNAME`; the backend converts only that provider-controlled
hostname to the canonical HTTPS public origin.

## Environment variables

The Blueprint configures all required values:

| Variable | Production value/purpose |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | Render PostgreSQL `connectionString` |
| `SECRET_KEY` | Render-generated random secret |
| `COOKIE_SECURE` | `1` |
| `COOKIE_SAMESITE` | `none`, required by the separately bundled Android origin |
| `CAPACITOR_ORIGINS` | `https://localhost` (the Capacitor WebView origin, not a backend URL) |
| `CREATE_TABLES_ON_STARTUP` | `0`; Alembic owns the schema |
| `SEED_DEMO_IF_EMPTY` | `1`; initializes only an empty database |
| `SEED_DEMO_ON_STARTUP` | `0`; prevents password/data resets |
| `LOG_LEVEL` | `INFO` |

For a web-only deployment, `COOKIE_SAMESITE=lax` and an empty
`CAPACITOR_ORIGINS` are sufficient. Add only exact HTTPS origins to
`ALLOWED_ORIGINS`; never use `*` with credentialed requests.

## Preserve the existing SQLite records

Before migration, back up both databases. Apply the newest schema to the local
SQLite database:

```powershell
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
cd ..
```

Set `DATABASE_URL` to Render PostgreSQL's external URL in the current shell,
then run the guarded copier. The URL is read from the environment and is never
accepted as a command-line argument:

```powershell
Push-Location backend
$env:DATABASE_URL = "postgresql://<render-user>:<password>@<external-host>/<database>"
..\.venv\Scripts\python.exe -m alembic upgrade head
Pop-Location
.\.venv\Scripts\python.exe scripts/migrate_sqlite_to_postgres.py --source backend/neurolearnx.db
```

If the initial deployment already created demo rows, the copier refuses to
overwrite them. After confirming a Render database backup, add `--replace` to
replace only the NeuroLearn-X application tables. It copies relationships,
authentication records, assessments, pathways, analytics, and embeds trained
model artifacts in PostgreSQL. It then aligns PostgreSQL sequences.

## Verification

Verify these public endpoints and flows:

- `/api/health`: identity and version.
- `/api/health/live`: process liveness.
- `/api/health/ready`: PostgreSQL query readiness.
- `/`: direct real application homepage.
- Student: `STEM001` / `LearnX!2026`.
- Teacher: `TEACHER01` / `NeuroTeach!2026`.

Log in as both roles, create or update a record, redeploy the service, and
confirm the record persists. Then test registration, assessment submission,
mental-effort rating, pathway regeneration, teacher inspection, Question
Studio upload/generation, exports, refresh/deep links, and installation from a
second device. The health response must be `no-store`, and compiled production
assets must contain no loopback or private-network backend URL.

## Update a deployment

Push the tested commit to the connected branch. Render rebuilds the Docker
image, runs deployment validation and Alembic migrations, and replaces the
service only after its health check succeeds. Do not delete or recreate the
PostgreSQL resource during ordinary updates. Back up research data before every
schema or bulk-data change.
