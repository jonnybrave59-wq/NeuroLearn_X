"""Build a secret-free, reproducible source backup in release/."""

from __future__ import annotations

import hashlib
import os
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / "release"
VERSION = "1.3.0"
ARCHIVE = RELEASE / f"NeuroLearn-X-Source-v{VERSION}.zip"
SOURCE_CODE_ARCHIVE = RELEASE / "NeuroLearn-X-Source-Code.zip"

EXCLUDED_PARTS = {
    ".git",
    ".deployment-backup",
    ".venv",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".gradle",
    ".idea",
    "release",
    "models",
    "coverage",
    "playwright-report",
    "tmp",
    "verification",
    "NeuroLearn-X-HTML-App",
}
EXCLUDED_SUFFIXES = {
    ".db",
    ".sqlite",
    ".sqlite3",
    ".joblib",
    ".apk",
    ".aab",
    ".log",
    ".pyc",
    ".pyo",
    ".tsbuildinfo",
}
EXCLUDED_NAMES = {
    ".env",
    "local.properties",
    "google-services.json",
}


def included(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    relative_posix = relative.as_posix()
    if any(part in EXCLUDED_PARTS for part in relative.parts):
        return False
    if relative_posix.startswith("frontend/android/app/src/main/assets/public/"):
        return False
    if relative_posix in {
        "frontend/android/app/src/main/assets/capacitor.config.json",
        "frontend/android/app/src/main/assets/capacitor.plugins.json",
        "frontend/android/app/src/main/res/xml/config.xml",
    }:
        return False
    if path.name in EXCLUDED_NAMES or path.suffix.lower() in EXCLUDED_SUFFIXES:
        return False
    return path.is_file()


def files() -> list[Path]:
    return sorted(
        (path for path in ROOT.rglob("*") if included(path)),
        key=lambda path: path.relative_to(ROOT).as_posix(),
    )


def validate(paths: list[Path]):
    forbidden = [
        path
        for path in paths
        if path.name == ".env"
        or path.suffix.lower() in {".db", ".joblib", ".apk", ".jks", ".keystore"}
    ]
    if forbidden:
        raise RuntimeError(f"Private/generated files selected: {forbidden}")
    required = [
        "frontend/src/App.tsx",
        "frontend/src/api-config.ts",
        "frontend/src/connection.ts",
        "frontend/src/AuthPages.tsx",
        "frontend/src/HomePage.tsx",
        "frontend/src/HomePage.test.tsx",
        "frontend/src/TeacherAuthoring.tsx",
        "frontend/src/TeacherStudents.tsx",
        "frontend/src/pwa.tsx",
        "frontend/src/pwa.test.tsx",
        "frontend/src/offline.ts",
        "frontend/src/offline.test.ts",
        "frontend/capacitor.config.ts",
        "frontend/scripts/validate-android-env.mjs",
        "frontend/android/gradlew",
        "backend/app/main.py",
        "backend/app/seed.py",
        "backend/app/seed_if_empty.py",
        "backend/app/tutoring.py",
        "backend/alembic/versions/0001_initial.py",
        "backend/alembic/versions/0002_accounts_authoring.py",
        "backend/alembic/versions/0003_adaptive_learning.py",
        "backend/alembic/versions/0004_intelligent_tutoring.py",
        "backend/alembic/versions/0005_model_artifact.py",
        "backend/tests/test_api.py",
        "backend/tests/test_extended_features.py",
        "backend/tests/test_revision_features.py",
        "backend/tests/test_production_security.py",
        "backend/tests/test_intelligent_tutoring.py",
        "frontend/src/timer.ts",
        "frontend/src/timer.test.ts",
        "scripts/validate_release.py",
        "scripts/package_full_system.py",
        "scripts/validate_full_system.py",
        "scripts/validate_deployment.py",
        "scripts/migrate_sqlite_to_postgres.py",
        "scripts/build_shareable_package.py",
        "scripts/generate_launcher_assets.py",
        "scripts/generate_quick_guide.py",
        "scripts/validate_shareable.py",
        "launcher/NeuroLearnX.Launcher/NeuroLearnX.Launcher.csproj",
        "launcher/NeuroLearnX.Launcher/Program.cs",
        "launcher/NeuroLearnX.Launcher/MainForm.cs",
        "launcher/launcher-config.json",
        "launcher/assets/neurolearnx.ico",
        "launcher/templates/Open NeuroLearn-X.bat.template",
        "launcher/templates/Open NeuroLearn-X.url.template",
        "launcher/templates/README-FIRST.txt.template",
        "launcher/templates/LICENSE.txt",
        ".github/workflows/build-windows-shareable.yml",
        ".github/workflows/build-android-apk.yml",
        ".env.example",
        ".dockerignore",
        "Dockerfile",
        "render.yaml",
        ".replit",
        "README.md",
        "DEPLOYMENT.md",
        "ANDROID_BUILD.md",
        "WINDOWS_LAUNCHER_BUILD.md",
        "full-system/README-FIRST.md",
        "full-system/FULL-SYSTEM-SETUP.md",
        "full-system/Setup-NeuroLearn-X.ps1",
        "full-system/Start-NeuroLearn-X.ps1",
        "full-system/Dockerfile",
    ]
    relative = {path.relative_to(ROOT).as_posix() for path in paths}
    missing = [path for path in required if path not in relative]
    if missing:
        raise RuntimeError(f"Source backup is incomplete: {missing}")


def main():
    selected = files()
    validate(selected)
    RELEASE.mkdir(exist_ok=True)
    if ARCHIVE.exists():
        ARCHIVE.unlink()
    with zipfile.ZipFile(ARCHIVE, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source in selected:
            relative = source.relative_to(ROOT).as_posix()
            info = zipfile.ZipInfo(f"NeuroLearn-X-v{VERSION}/{relative}")
            info.date_time = (2026, 8, 3, 12, 0, 0)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o755 if os.access(source, os.X_OK) else 0o644) << 16
            archive.writestr(info, source.read_bytes())
    shutil.copy2(ARCHIVE, SOURCE_CODE_ARCHIVE)
    digest = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
    for output in (ARCHIVE, SOURCE_CODE_ARCHIVE):
        checksum = output.with_suffix(".zip.sha256")
        checksum.write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    print(f"Created {ARCHIVE.relative_to(ROOT)} ({ARCHIVE.stat().st_size:,} bytes)")
    print(
        f"Created {SOURCE_CODE_ARCHIVE.relative_to(ROOT)} "
        f"({SOURCE_CODE_ARCHIVE.stat().st_size:,} bytes)"
    )
    print(f"SHA-256 {digest}")


if __name__ == "__main__":
    main()
