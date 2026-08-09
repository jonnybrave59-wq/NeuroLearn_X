"""Create a runnable full-stack NeuroLearn-X distribution."""

from __future__ import annotations

import hashlib
import json
import os
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / "release"
OUTPUT = RELEASE / "NeuroLearn-X-Full-System.zip"
VERSION = "1.3.1"
PREFIX = "NeuroLearn-X/"
FIXED_TIME = (2026, 8, 5, 12, 0, 0)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def collect_tree(base: Path, destination: str, *, suffixes: set[str] | None = None):
    result: dict[str, bytes] = {}
    for source in sorted(path for path in base.rglob("*") if path.is_file()):
        relative = source.relative_to(base)
        if any(part in {"__pycache__", ".pytest_cache"} for part in relative.parts):
            continue
        if source.suffix.lower() in {".db", ".log", ".pyc", ".pyo"}:
            continue
        if suffixes is not None and source.suffix.lower() not in suffixes:
            continue
        target = (Path(destination) / relative).as_posix()
        result[target] = source.read_bytes()
    return result


def package_files() -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    files.update(collect_tree(ROOT / "backend" / "app", "backend/app", suffixes={".py"}))
    files.update(collect_tree(ROOT / "backend" / "alembic", "backend/alembic"))
    files.update(collect_tree(ROOT / "frontend" / "dist", "frontend/dist"))
    for relative in ("backend/alembic.ini", "backend/requirements.txt"):
        files[relative] = (ROOT / relative).read_bytes()
    files["scripts/validate_deployment.py"] = (
        ROOT / "scripts" / "validate_deployment.py"
    ).read_bytes()
    files["scripts/migrate_sqlite_to_postgres.py"] = (
        ROOT / "scripts" / "migrate_sqlite_to_postgres.py"
    ).read_bytes()
    files["scripts/smoke_test_deployment.py"] = (
        ROOT / "scripts" / "smoke_test_deployment.py"
    ).read_bytes()
    files["render.yaml"] = (ROOT / "render.yaml").read_bytes()
    files["LICENSE.txt"] = (ROOT / "launcher" / "templates" / "LICENSE.txt").read_bytes()

    for source in sorted(path for path in (ROOT / "full-system").rglob("*") if path.is_file()):
        files[source.relative_to(ROOT / "full-system").as_posix()] = source.read_bytes()

    manifest = {
        "name": "NeuroLearn-X Full System",
        "version": VERSION,
        "architecture": "FastAPI backend serving a compiled React PWA with relative /api routes",
        "database": {
            "local": "SQLite initialized by the setup script",
            "production": "PostgreSQL configured through DATABASE_URL",
            "migrations": "Alembic 0001 through 0008",
        },
        "health_endpoint": "/api/health",
        "pwa": True,
        "frontend_only": False,
    }
    files["package-manifest.json"] = (
        json.dumps(manifest, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    files["version.txt"] = f"NeuroLearn-X {VERSION}\n".encode("utf-8")
    return files


def validate_inputs(files: dict[str, bytes]) -> None:
    required = {
        "README-FIRST.md",
        "FULL-SYSTEM-SETUP.md",
        "Setup-NeuroLearn-X.bat",
        "Start-NeuroLearn-X.bat",
        "Dockerfile",
        "backend/app/main.py",
        "backend/app/seed_if_empty.py",
        "backend/app/tutoring.py",
        "backend/app/production_accounts.py",
        "backend/alembic/versions/0004_intelligent_tutoring.py",
        "backend/alembic/versions/0005_model_artifact.py",
        "backend/alembic/versions/0006_teacher_refinement_evidence.py",
        "backend/alembic/versions/0007_learner_onboarding.py",
        "backend/alembic/versions/0008_production_hardening.py",
        "backend/requirements.txt",
        "frontend/dist/index.html",
        "frontend/dist/manifest.webmanifest",
        "frontend/dist/sw.js",
        "scripts/validate_deployment.py",
        "scripts/migrate_sqlite_to_postgres.py",
        "scripts/smoke_test_deployment.py",
        "render.yaml",
    }
    missing = sorted(required.difference(files))
    if missing:
        raise RuntimeError(f"Full-system inputs are incomplete: {missing}")
    forbidden = [
        name
        for name in files
        if Path(name).name == ".env"
        or Path(name).suffix.lower() in {".db", ".log", ".pyc", ".sqlite", ".sqlite3"}
    ]
    if forbidden:
        raise RuntimeError(f"Private/generated files selected: {forbidden}")

    production_text = b"\n".join(
        data
        for name, data in files.items()
        if name.startswith("frontend/dist/")
        and Path(name).suffix.lower() in {".html", ".js", ".css"}
    ).decode("utf-8", errors="ignore")
    if "http://localhost" in production_text or "http://127.0.0.1" in production_text:
        raise RuntimeError("The compiled frontend contains a development URL")
    if 'healthUrl:"/api/health"' not in production_text.replace(" ", ""):
        raise RuntimeError("The compiled frontend does not expose relative /api/health")


def write_archive(files: dict[str, bytes]) -> str:
    checksums = "".join(
        f"{digest(data)}  *{name}\n" for name, data in sorted(files.items())
    ).encode("utf-8")
    files = {**files, "checksums.txt": checksums}
    RELEASE.mkdir(exist_ok=True)
    if OUTPUT.exists():
        OUTPUT.unlink()
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for relative, data in sorted(files.items()):
            info = zipfile.ZipInfo(PREFIX + relative)
            info.date_time = FIXED_TIME
            info.compress_type = zipfile.ZIP_DEFLATED
            executable = relative.endswith((".sh", ".ps1", ".bat"))
            info.external_attr = (0o755 if executable else 0o644) << 16
            archive.writestr(info, data)
    archive_digest = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    OUTPUT.with_suffix(".zip.sha256").write_text(
        f"{archive_digest}  {OUTPUT.name}\n", encoding="utf-8"
    )
    return archive_digest


def main() -> None:
    files = package_files()
    validate_inputs(files)
    archive_digest = write_archive(files)
    print(f"Created {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")
    print(f"SHA-256 {archive_digest}")


if __name__ == "__main__":
    main()
