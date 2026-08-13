"""Validate PWA assets and every public file in release/."""

from __future__ import annotations

import hashlib
import json
import struct
import zipfile
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parents[1]
VERSION = "1.3.1"
RELEASE = ROOT / "release"
SOURCE_ARCHIVE = RELEASE / f"NeuroLearn-X-Source-v{VERSION}.zip"
SOURCE_CODE_ARCHIVE = RELEASE / "NeuroLearn-X-Source-Code.zip"


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise RuntimeError(f"{path.relative_to(ROOT)} is not a valid PNG")
    return struct.unpack(">II", data[16:24])


def validate_pwa() -> None:
    dist = ROOT / "frontend" / "dist"
    manifest = json.loads((dist / "manifest.webmanifest").read_text(encoding="utf-8"))
    expected = {
        "name": "NeuroLearn-X",
        "short_name": "NeuroLearn-X",
        "display": "standalone",
        "theme_color": "#071b34",
        "background_color": "#f3f7fa",
        "orientation": "any",
    }
    mismatches = {
        key: (manifest.get(key), value)
        for key, value in expected.items()
        if manifest.get(key) != value
    }
    if mismatches:
        raise RuntimeError(f"Invalid PWA manifest fields: {mismatches}")

    icons = {
        "icons/icon-192.png": (192, 192),
        "icons/icon-512.png": (512, 512),
        "icons/icon-maskable-512.png": (512, 512),
    }
    for relative, expected_size in icons.items():
        actual_size = png_size(dist / relative)
        if actual_size != expected_size:
            raise RuntimeError(
                f"{relative} is {actual_size}, expected {expected_size}"
            )
    maskable = [
        icon
        for icon in manifest.get("icons", [])
        if icon.get("purpose") == "maskable"
        and icon.get("src") == "/icons/icon-maskable-512.png"
    ]
    if not maskable:
        raise RuntimeError("The manifest does not declare the maskable icon")

    service_worker = (dist / "sw.js").read_text(encoding="utf-8")
    for required_asset in ("index.html", "offline.html", "manifest.webmanifest"):
        if required_asset not in service_worker:
            raise RuntimeError(f"Service worker does not precache {required_asset}")
    for required_rule in (
        "neurolearnx-v1.3.1",
        "skipWaiting()",
        "clientsClaim()",
        "NetworkOnly",
        "cleanupOutdatedCaches",
    ):
        if required_rule not in service_worker:
            raise RuntimeError(f"Service worker is missing {required_rule}")

    production_text = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in dist.rglob("*")
        if path.is_file() and path.suffix.lower() in {".html", ".js", ".css"}
    )
    for forbidden in (
        "http://127.0.0.1:8021",
        "http://localhost:8021",
        "Internet connection is required for this feature",
    ):
        if forbidden in production_text:
            raise RuntimeError(f"Production build contains forbidden text: {forbidden}")


def checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_source_archive(source_archive: Path) -> None:
    source_checksum = source_archive.with_suffix(".zip.sha256")
    if not source_archive.is_file() or not source_checksum.is_file():
        raise RuntimeError(f"{source_archive.name} or its checksum is missing")
    recorded = source_checksum.read_text(encoding="utf-8").split()[0]
    actual = checksum(source_archive)
    if recorded != actual:
        raise RuntimeError(f"{source_archive.name} checksum does not match")

    with zipfile.ZipFile(source_archive) as archive:
        damaged = archive.testzip()
        if damaged:
            raise RuntimeError(f"Damaged source archive entry: {damaged}")
        names = archive.namelist()

    prefix = f"NeuroLearn-X-v{VERSION}/"
    required = {
        f"{prefix}frontend/src/App.tsx",
        f"{prefix}frontend/src/api-config.ts",
        f"{prefix}frontend/src/api-config.test.ts",
        f"{prefix}frontend/src/api.ts",
        f"{prefix}frontend/src/api.test.ts",
        f"{prefix}frontend/src/connection.ts",
        f"{prefix}frontend/src/AuthPages.tsx",
        f"{prefix}frontend/src/HomePage.tsx",
        f"{prefix}frontend/src/HomePage.test.tsx",
        f"{prefix}frontend/src/TeacherAuthoring.tsx",
        f"{prefix}frontend/src/TeacherStudents.tsx",
        f"{prefix}frontend/src/pwa.tsx",
        f"{prefix}frontend/src/pwa.test.tsx",
        f"{prefix}frontend/capacitor.config.ts",
        f"{prefix}frontend/scripts/validate-android-env.mjs",
        f"{prefix}frontend/android/gradlew",
        f"{prefix}backend/app/main.py",
        f"{prefix}backend/app/seed.py",
        f"{prefix}backend/app/seed_if_empty.py",
        f"{prefix}backend/app/tutoring.py",
        f"{prefix}backend/app/production_accounts.py",
        f"{prefix}backend/alembic/versions/0001_initial.py",
        f"{prefix}backend/alembic/versions/0002_accounts_authoring.py",
        f"{prefix}backend/alembic/versions/0003_adaptive_learning.py",
        f"{prefix}backend/alembic/versions/0004_intelligent_tutoring.py",
        f"{prefix}backend/alembic/versions/0005_model_artifact.py",
        f"{prefix}backend/alembic/versions/0006_teacher_refinement_evidence.py",
        f"{prefix}backend/alembic/versions/0007_learner_onboarding.py",
        f"{prefix}backend/alembic/versions/0008_production_hardening.py",
        f"{prefix}backend/tests/test_api.py",
        f"{prefix}backend/tests/test_extended_features.py",
        f"{prefix}backend/tests/test_revision_features.py",
        f"{prefix}backend/tests/test_intelligent_tutoring.py",
        f"{prefix}frontend/src/timer.ts",
        f"{prefix}frontend/src/timer.test.ts",
        f"{prefix}scripts/package_full_system.py",
        f"{prefix}scripts/migrate_sqlite_to_postgres.py",
        f"{prefix}scripts/smoke_test_deployment.py",
        f"{prefix}scripts/validate_full_system.py",
        f"{prefix}full-system/README-FIRST.md",
        f"{prefix}full-system/FULL-SYSTEM-SETUP.md",
        f"{prefix}full-system/Setup-NeuroLearn-X.ps1",
        f"{prefix}full-system/Start-NeuroLearn-X.ps1",
        f"{prefix}full-system/Dockerfile",
        f"{prefix}launcher/NeuroLearnX.Launcher/NeuroLearnX.Launcher.csproj",
        f"{prefix}launcher/NeuroLearnX.Launcher/Program.cs",
        f"{prefix}launcher/NeuroLearnX.Launcher/MainForm.cs",
        f"{prefix}launcher/launcher-config.json",
        f"{prefix}launcher/assets/neurolearnx.ico",
        f"{prefix}scripts/build_shareable_package.py",
        f"{prefix}scripts/generate_quick_guide.py",
        f"{prefix}scripts/validate_shareable.py",
        f"{prefix}.github/workflows/build-windows-shareable.yml",
        f"{prefix}.github/workflows/build-android-apk.yml",
        f"{prefix}.github/workflows/production-ci.yml",
        f"{prefix}.env.example",
        f"{prefix}.dockerignore",
        f"{prefix}Dockerfile",
        f"{prefix}vercel.json",
        f"{prefix}.replit",
        f"{prefix}README.md",
        f"{prefix}Start-NeuroLearn-X.bat",
        f"{prefix}Start-NeuroLearn-X.ps1",
        f"{prefix}DEPLOYMENT.md",
        f"{prefix}ANDROID_BUILD.md",
        f"{prefix}WINDOWS_LAUNCHER_BUILD.md",
    }
    missing = sorted(required.difference(names))
    if missing:
        raise RuntimeError(f"Source archive is incomplete: {missing}")

    forbidden_suffixes = {
        ".apk",
        ".db",
        ".jks",
        ".joblib",
        ".keystore",
        ".log",
        ".pyc",
        ".sqlite",
        ".sqlite3",
    }
    forbidden = []
    for name in names:
        path = PurePosixPath(name)
        if path.name == ".env" or path.suffix.lower() in forbidden_suffixes:
            forbidden.append(name)
    if forbidden:
        raise RuntimeError(f"Private or generated files found in source archive: {forbidden}")


def validate_release_directory() -> None:
    source_files = {
        SOURCE_ARCHIVE.name,
        SOURCE_ARCHIVE.with_suffix(".zip.sha256").name,
        SOURCE_CODE_ARCHIVE.name,
        SOURCE_CODE_ARCHIVE.with_suffix(".zip.sha256").name,
    }
    allowed = set(source_files)
    apk = RELEASE / "NeuroLearn-X.apk"
    apk_checksum = RELEASE / "NeuroLearn-X.apk.sha256"
    if apk.exists() or apk_checksum.exists():
        if not apk.is_file() or not apk_checksum.is_file():
            raise RuntimeError("APK and APK checksum must be published together")
        with zipfile.ZipFile(apk) as archive:
            if archive.testzip():
                raise RuntimeError("The APK archive is damaged")
            if "AndroidManifest.xml" not in archive.namelist():
                raise RuntimeError("The APK does not contain AndroidManifest.xml")
        recorded = apk_checksum.read_text(encoding="utf-8").split()[0]
        if recorded != checksum(apk):
            raise RuntimeError("APK checksum does not match")
        allowed.update({apk.name, apk_checksum.name})

    shareable = RELEASE / "NeuroLearn-X-Shareable.zip"
    if shareable.exists():
        from validate_shareable import validate as validate_shareable

        validate_shareable(shareable)
        allowed.add(shareable.name)

    full_system = RELEASE / "NeuroLearn-X-Full-System.zip"
    full_system_checksum = RELEASE / "NeuroLearn-X-Full-System.zip.sha256"
    if full_system.exists() or full_system_checksum.exists():
        if not full_system.is_file() or not full_system_checksum.is_file():
            raise RuntimeError("Full-system ZIP and checksum must be published together")
        from validate_full_system import validate as validate_full_system

        validate_full_system(full_system)
        recorded = full_system_checksum.read_text(encoding="utf-8").split()[0]
        if recorded != checksum(full_system):
            raise RuntimeError("Full-system ZIP checksum does not match")
        allowed.update({full_system.name, full_system_checksum.name})

    unexpected = sorted(
        path.name
        for path in RELEASE.iterdir()
        if path.is_file() and path.name not in allowed
    )
    if unexpected:
        raise RuntimeError(f"Unexpected public release files: {unexpected}")


def main() -> None:
    validate_pwa()
    validate_source_archive(SOURCE_ARCHIVE)
    validate_source_archive(SOURCE_CODE_ARCHIVE)
    validate_release_directory()
    print("PWA assets and public release files are valid.")


if __name__ == "__main__":
    main()
