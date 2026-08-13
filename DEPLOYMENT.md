# NeuroLearn-X Vercel deployment

NeuroLearn-X runs as two services in the existing Vercel project:

- `frontend`: the compiled React PWA.
- `backend`: the FastAPI application exported by `backend/vercel.py`.

Top-level rewrites send `/api` and `/api/*` directly to the backend service.
All other paths go to the frontend. The browser therefore uses stable,
same-origin `/api` routes without CORS, mixed-content, or sleeping-host
dependencies.

## Required production environment

Configure these values in the existing Vercel project. Store credentials as
sensitive variables and never expose them through `VITE_*` names.

| Variable | Purpose |
| --- | --- |
| `APP_ENV=production` | Enables production safeguards |
| `DATABASE_URL` | Existing PostgreSQL pooler connection |
| `SECRET_KEY` | Existing signing key, preserved so sessions remain valid |
| `PUBLIC_APP_URL` | `https://neurolearn-x-staging.vercel.app` |
| `FRONTEND_ORIGIN` | Same public origin |
| `ALLOWED_ORIGINS` | Same public origin |
| `COOKIE_SECURE=1` | HTTPS-only session cookie |
| `COOKIE_SAMESITE=none` | Supports the separately packaged native client |
| `CAPACITOR_ORIGINS=https://localhost` | Capacitor WebView origin, not an API URL |
| `CREATE_TABLES_ON_STARTUP=0` | Alembic owns the production schema |
| `SEED_DEMO_IF_EMPTY=0` | Prevents production data replacement |
| `SEED_DEMO_ON_STARTUP=0` | Prevents production data replacement |
| `DB_POOL_SIZE=1` | Serverless-safe PostgreSQL pool size |
| `DB_MAX_OVERFLOW=1` | Limits per-instance connections |
| `SUPABASE_URL` | Existing file-storage project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend-only storage credential |
| `SUPABASE_STORAGE_BUCKET` | Existing learning-materials bucket |

The frontend production build intentionally leaves `VITE_API_BASE_URL` empty.
Browser requests therefore use `/api`; no provider hostname is compiled into
the PWA.

## Database migration

Run migrations deliberately before deploying code that requires a new schema:

```powershell
Push-Location backend
..\.venv\Scripts\python.exe -m alembic upgrade head
Pop-Location
```

`GET /api/ready` verifies PostgreSQL connectivity and confirms that the
database is at revision `0010_gap_diagnoses`. It returns HTTP 503 when either
condition fails. `GET /api/health` is the database-independent liveness check.

## Deployment

The project is already linked through `.vercel/project.json`.

```powershell
npx vercel
npx vercel --prod
```

Push the tested commit to the connected GitHub `main` branch so later releases
remain reproducible. Inspect Vercel build and function logs after deployment.

## Required verification

1. Confirm `/api/health` returns HTTP 200 and version `1.3.9`.
2. Confirm `/api/ready` returns HTTP 200, `database: postgresql`, and the
   expected schema revision.
3. Register a student and verify the new record persists.
4. Verify student and teacher login, dashboard access, and refresh persistence.
5. Confirm `sw.js` uses the current versioned cache and network-only API rules.
6. Confirm the compiled production assets contain no external or development
   API origin.
7. Repeat the checks after at least 30 minutes with no application requests.

Do not automatically replay login, registration, assessment submissions, or
other write requests. Only the read-only readiness probe may retry during a
genuine serverless/database startup.
