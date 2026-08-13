# NeuroLearn-X

**NeuroLearn-X: An Explainable Computational Intelligence Framework Integrating Ensemble Machine Learning and Knowledge Graph-Based Learning-Gap Diagnosis for Adaptive Learning Pathway Recommendation**

NeuroLearn-X is a complete Grade 12 STEM research prototype for Hinatuan National Comprehensive High School. It records assessment evidence and learner interactions, calculates concept mastery, traces missing prerequisites through a directed acyclic knowledge graph, predicts cognitive load, generates several valid activity pathways, ranks them with multi-objective optimization, and explains the selected recommendation.

This repository contains a working application—not a static interface mockup.

## What is implemented

### Student workflow

- Student self-registration with unique student ID, username, and email checks
- Strong-password validation, show/hide controls, privacy-safe recovery requests, and logout
- Login by student ID, username, or email with account status and sign-in history
- Personal dashboard with profile, grade/section, account dates, recent activity, mastery, and pathway progress
- Personal dashboard and General Physics target selection
- Published-assessment list with availability, due dates, attempt limits, and assignment checks
- Persistent digital countdown timer with final-three-second audio cues, mute control, refresh recovery, and duplicate-safe automatic submission
- Timed multiple-choice, true/false, identification, and short-answer player
- Per-item response timing, answer changes, hint usage, and skipped-item tracking
- Server-side answer validation and score calculation
- Required 1–9 mental-effort rating after submission
- Student-facing effort bands follow the teacher-configured category boundaries
- Latest-attempt or recency-weighted mastery calculation
- Learning-gap report that keeps **Not Yet Assessed** separate from failure
- Prerequisite-aware pathway generation and interactive concept map
- Guided, standard, and faster-review candidate pathways
- GC, PCL, NLT, and APS candidate ranking
- Plain-language, feature-level, graph, probability, and score explanations
- Explanation-first pathway lessons with formulas, worked examples, guided and independent practice, evidence-gated mastery checks, history, retakes, and password settings
- Automatic recommendation refresh after new evidence

### Teacher workflow

- Dashboard and a paginated student-management table with clickable learner rows, search, advanced filters, sorting, and active/archived views
- Student lifecycle actions for inspection, password reset, deactivation/reactivation, archive, and soft removal
- Confirmation dialogs, one-time temporary password display, and a complete audit trail
- Concept create/edit/archive/restore
- Cycle-safe knowledge-graph edge editor
- Activity bank with soft deletion
- Secure PDF, DOCX, PPTX, and TXT learning-material upload and text extraction
- Local material-grounded analysis and draft generation with source locators, calculation support, validation flags, solution steps, and configurable subject, topic, concept, competency, type, difficulty, and cognitive level
- Learner-topic evidence inspection plus previewable, editable, prerequisite-safe teacher pathway assignment with notes, due dates, notifications, and assignment history
- Teacher review workspace with inline editing, regeneration, duplication, selection, batch actions, and explicit draft/bank/publication actions
- Reusable question bank with question, subject, topic, concept, type, difficulty, source-document, and status filters
- Assessment publication controls for assignment, schedule, deadline, mastery threshold, attempts, shuffling, score visibility, and explanations
- Draft, scheduled, published, closed, and archived assessment lifecycle controls
- Configurable mastery method and threshold
- Configurable mental-effort boundaries and expert Likert scale
- Alpha/beta/gamma validation; saving is blocked unless the total is exactly 1
- Demo/research model training modes
- Versioned Logistic Regression, Random Forest, and Gradient Boosting ensemble
- Student-grouped cross-validation, metrics, confusion matrix, and ROC-AUC when computable
- Candidate pathway comparison and expert evaluation form
- Anonymized CSV exports and teacher audit log
- Confirmation-protected demonstration-data reset

### Research and privacy controls

- PBKDF2-SHA256 password hashing with per-password salts
- HTTP-only signed session cookies
- Server-side role checks and student ownership enforcement
- Teacher-issued temporary passwords require a password change
- Student and teacher login forms isolate credential entry by role
- Rate limits for login, registration, recovery requests, and document upload
- Upload size, filename, MIME, signature, archive-expansion, page-count, and extracted-text validation
- Anonymous participant codes in exports
- Consent records and audit logs
- Demo/research flags on research-bearing tables
- Demonstration metrics labeled **“Demonstration Data – Not a Research Result.”**
- Research mode never trains on or exports demo rows
- Demo reset preserves research users, consent, pathways, evaluations, and audit history
- Temporary fallback estimates clearly labeled when validated data are insufficient
- Important educational records use an active/archive flag rather than destructive deletion

### Install, offline, and sharing

- Installable PWA for Android, Windows, and Safari Add to Home Screen
- Standalone portrait/landscape experience with branded standard and maskable icons
- Versioned service worker, cached application shell, offline page, and update prompt
- No browser persistence of identities, authenticated API responses, or research records
- Explicit internet-required errors for every authenticated student/teacher operation
- Sanitized Web Share, Copy Link, and public QR-code controls for students and teachers
- Public `/#/download` page with platform instructions and privacy notice
- Capacitor Android project with minimal permissions and an automated APK workflow

## Architecture

```text
frontend/                         React + TypeScript + Vite + Tailwind
  src/App.tsx                     role selection and secure routing
  src/HomePage.tsx                public overview and portal entry points
  src/AuthPages.tsx               registration and account recovery
  src/StudentApp.tsx              student pages and assessment player
  src/TeacherApp.tsx              teacher administration pages
  src/TeacherStudents.tsx         student-management workspace
  src/TeacherAuthoring.tsx        upload, question bank, and publication tools
  src/pwa.tsx                     install, update, connection, share, and QR controls
  src/offline.ts                  private-cache prevention and legacy-cache cleanup
  android/                        Capacitor Android wrapper
backend/
  app/main.py                     FastAPI routes and production SPA serving
  app/models.py                   SQLAlchemy relational schema
  app/algorithms.py               mastery, DAG, and optimization calculations
  app/ml.py                       grouped ensemble training and prediction
  app/services.py                 mastery, gaps, pathways, explanations
  app/seed.py                     repeatable academic/demo seed
  alembic/                        versioned database migrations
  tests/                          API, privacy, algorithm, and ML tests
scripts/                          local, Replit, icon, and release-package helpers
release/                          verified downloadable artifacts only
```

FastAPI serves the compiled React application at `/` and the API at `/api`, producing one usable URL in production.

## Core calculations

Mastery:

```text
M = earned concept points / maximum concept points
```

Expected Cognitive-Load Index:

```text
CL = 0·P(Low) + 0.5·P(Moderate) + 1·P(High)
```

Candidate metrics:

```text
GC  = addressed relevant gaps / diagnosed relevant gaps
PCL = mean expected cognitive-load index across pathway activities
NLT = (LT - LTmin) / (LTmax - LTmin)
APS = αGC + β(1 - PCL) + γ(1 - NLT)
```

When there are no diagnosed gaps, `GC = 1`. When all candidate times are equal, every candidate receives `NLT = 0`, avoiding division by zero. Default weights are `α=.50`, `β=.30`, and `γ=.20`.

## Development credentials

These accounts are synthetic and are only for development:

| Role | Code | Password |
|---|---|---|
| Teacher | `TEACHER01` | `NeuroTeach!2026` |
| Student | `STEM001` through `STEM006` | `LearnX!2026` |

All seeded users have `must_change_password=true`. Change every default password and the application secret before any real deployment.

## Local setup

For the existing built application, double-click `Start-NeuroLearn-X.bat` in
the project root. Do not open `frontend/dist/index.html` directly: NeuroLearn-X
is a full-stack system and the compiled interface requires FastAPI `/api`
routes, authentication, and the database.

### 1. Create the Python environment

From the project root on Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
```

On Linux/macOS:

```bash
python -m venv .venv
./.venv/bin/python -m pip install -r backend/requirements.txt
```

### 2. Install and build the frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Configure PostgreSQL

Start the included PostgreSQL service:

```bash
docker compose up -d postgres
```

Copy `.env.example` to `.env`, change the password/secret, and make `DATABASE_URL` available in the shell:

```text
postgresql+psycopg://neurolearnx:neurolearnx-dev@localhost:5432/neurolearnx
```

For a zero-configuration local demonstration only, omitting `DATABASE_URL` uses `backend/neurolearnx.db` (SQLite). PostgreSQL is the intended research/deployment database.

### 4. Migrate and seed

```powershell
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m app.seed
```

The seed is repeatable. It creates:

- 11 academic concepts and a cycle-safe prerequisite graph
- 33 activities (diagnostic, guided, and quick-review options)
- 110 question instances, including five diagnostic questions per concept
- six synthetic learners and one teacher
- 54 synthetic assessment attempts, interaction logs, mental-effort labels, mastery records, and gaps
- three ranked pathways per learner
- one model version evaluated and trained using synthetic demo data

Migration `0002_accounts_authoring` upgrades an existing database with account
metadata, login history, document sources, reusable question metadata,
assessments, assignments, and free-text responses. Run `alembic upgrade head`
before starting an upgraded deployment.

Migration `0003_adaptive_learning` adds source-grounded question analysis,
validation and solution metadata, adaptive pathway teaching content, completion
evidence, teacher assignment provenance, notes, due dates, and preserved pathway
history. It is additive and keeps existing learner and research records intact.

### 5. Run

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

On Windows, `.\scripts\start.ps1` builds, migrates, seeds, and starts the application.

## Frontend development

Run the API on port 8000, then:

```bash
cd frontend
npm run dev
```

Vite opens on `http://127.0.0.1:5173` and proxies relative `/api` routes to FastAPI.

## Assessment authoring

Teachers can upload PDF, DOCX, PPTX, or UTF-8 TXT material up to
`MAX_UPLOAD_SIZE_MB` (10 MB by default). Office archives are checked for unsafe
expansion, PDFs are limited to 250 pages, and extracted text is sanitized and
bounded by `MAX_EXTRACTED_TEXT_CHARS`.

The built-in generator is deterministic and extractive: it creates editable
drafts from readable source sentences without sending student or document data
to an external AI service. Generated content is never published automatically.
A teacher must review the questions and explicitly save them to the question
bank or create an assessment. If a future external AI provider is added, keep
the same review gate and configure its credentials only as server-side secrets.

## PWA installation and sharing

- Android: open the deployed HTTPS URL in Chrome and choose **Install NeuroLearn-X**.
- Windows: open it in Chrome or Edge and select the install icon in the address bar.
- iPhone/iPad: open it in Safari, tap **Share**, then **Add to Home Screen**.

The custom install button is hidden when the app is already installed or the
current browser offers no supported installation path. Browsers that expose the
native installation prompt use it directly; supported Safari and Chromium
browsers without that event receive platform-specific manual guidance. Share
links contain only the canonical public origin and
`#/`; authenticated routes, query parameters, passwords, tokens, and
identifiers are never placed in the link or QR code.

Offline access is intentionally limited to the public application shell and
offline notice. Sign-in, identities, dashboards, pathways, progress,
assessments, and all teacher/ML operations require a live server. Legacy
NeuroLearn-X IndexedDB data is removed automatically.

## Vercel deployment

The existing Vercel Services project builds the React PWA and FastAPI backend
in one deployment. Same-origin `/api` requests route directly to the FastAPI
service, which uses the preserved PostgreSQL database configured by
`DATABASE_URL`. Follow [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Android wrapper

The complete Capacitor project uses package `com.hnchs.neurolearnx`. A local
Android SDK is required to compile it. The GitHub Actions workflow builds and
uploads `NeuroLearn-X.apk` only after the repository variable
`NEUROLEARNX_PUBLIC_URL` points to the deployed HTTPS backend. Follow
[`ANDROID_BUILD.md`](ANDROID_BUILD.md).

## Windows shareable package

The portable Windows launcher opens only a configured HTTPS deployment in a
dedicated WebView2 window. It includes a single-instance guard, remembered
window size, offline/retry/browser fallbacks, no URL credentials, disabled
password autofill, and `.bat`/`.url` alternatives.

The final `release/NeuroLearn-X-Shareable.zip` is intentionally not produced
from a placeholder address. After the permanent public deployment exists, use
the Windows GitHub Actions workflow and complete the second-computer check in
[`WINDOWS_LAUNCHER_BUILD.md`](WINDOWS_LAUNCHER_BUILD.md). The download page
remains disabled until that validated ZIP is copied into `release/` and
`VITE_WINDOWS_PACKAGE_AVAILABLE=true` is set for the deployment.

## Source backup

Create a secret-free source archive:

```powershell
.\.venv\Scripts\python.exe .\scripts\package_source.py
.\.venv\Scripts\python.exe .\scripts\validate_release.py
```

The script excludes `.env`, databases, model binaries, caches, temporary PDF
work, build outputs, keystores, logs, and APKs. It verifies required frontend,
backend, migration, test, PWA, Android, Windows launcher, deployment, workflow,
and documentation files. It writes both the versioned archive and the exact
`release/NeuroLearn-X-Source-Code.zip` backup with SHA-256 checksums. The
validation command checks the manifest, icons, service-worker precache, both
source archives, checksums, and every public release filename.

## Automated tests

Backend:

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q
```

Frontend:

```bash
cd frontend
npm test
npm run build
```

The 40 backend tests cover registration, duplicate protection, login and role
restrictions, audited account lifecycle actions, secure document generation,
question-bank reuse, draft-to-published assessment control, assignment and
attempt limits, hidden results, server-side scoring, interaction logging,
mastery and gap classification, graph safety, privacy, exports, and grouped
ensemble evaluation. The 27 frontend tests cover API error behavior, PWA
state/synchronization controls, and the public homepage contract. The production
build also validates TypeScript and the service-worker precache.

## Machine-learning notes

- Numeric inputs are fit with `MinMaxScaler` only on each training fold.
- Evaluation uses `StratifiedGroupKFold` when class/group counts permit, with students as groups.
- The three classifiers use equal-weight soft voting over class probabilities.
- No performance metric is hardcoded or fabricated.
- Model bundles are saved locally in `backend/models/` and persisted with their
  version record in PostgreSQL so a cloud redeploy cannot discard the active model.
- The selected pathway explanation attempts class-specific Random Forest SHAP values. If SHAP is unavailable or unsupported for a fitted model, the UI explicitly reports approximate ensemble feature importance instead.
- A small validated sample produces a warning; insufficient research data prevent training and trigger a labeled rule-based estimate.

## Current limitations

- The included participant data and model metrics are synthetic demonstration data, never research findings.
- PostgreSQL must be supplied by the deployment environment; the repository uses SQLite only as a local zero-configuration fallback.
- The seeded cohort is intentionally small. Metrics are useful for workflow demonstration but not for scientific conclusions.
- Multiple-choice and true/false items use exact server-side scoring.
  Identification uses normalized exact matching, while short-answer scoring is
  a transparent reference-answer token-overlap heuristic and should be reviewed
  by a teacher for high-stakes use.
- The question generator is a local extractive drafting aid, not a generative
  language model and not a substitute for teacher review.
- External learning-management-system integrations are outside the current scope.
- SHAP is applied to the Random Forest component for the predicted class; the displayed ensemble probability still combines all three classifiers equally. When SHAP cannot be computed, the fallback is labeled approximate.
- Offline mode displays only the public app shell; it never exposes cached identities, dashboards, pathways, progress, assessments, or teacher records.
- iPhone/iPad installation uses Safari's Add to Home Screen menu because iOS does not provide the Chromium install-prompt event.
- The Android APK remains an external artifact until its signed build and
  physical-device checks are completed against the production HTTPS URL.
