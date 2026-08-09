"""Validate NeuroLearn-X-HTML-App.zip and its internal checksums."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path, PurePosixPath


PREFIX = "NeuroLearn-X-HTML-App/"
VERSION = "1.3.1"
REQUIRED = {
    "README-HTML-APP.md",
    "Start-NeuroLearn-X-HTML-App.bat",
    "Start-NeuroLearn-X-HTML-App.ps1",
    "Start-NeuroLearn-X-HTML-App.sh",
    "Setup-NeuroLearn-X.bat",
    "Start-NeuroLearn-X.bat",
    "FULL-SYSTEM-SETUP.md",
    "backend/app/main.py",
    "backend/app/tutoring.py",
    "backend/alembic/versions/0004_intelligent_tutoring.py",
    "backend/alembic/versions/0005_model_artifact.py",
    "backend/requirements.txt",
    "frontend/dist/index.html",
    "frontend/dist/manifest.webmanifest",
    "frontend/dist/sw.js",
    "package-manifest.json",
    "checksums.txt",
    "version.txt",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate(path: Path) -> None:
    with zipfile.ZipFile(path) as archive:
        damaged = archive.testzip()
        if damaged:
            raise RuntimeError(f"Damaged ZIP entry: {damaged}")
        names = archive.namelist()
        if any(not name.startswith(PREFIX) for name in names):
            raise RuntimeError("Every HTML App file must be inside NeuroLearn-X-HTML-App/")
        relative = {
            name.removeprefix(PREFIX): name
            for name in names
            if name != PREFIX and not name.endswith("/")
        }
        missing = sorted(REQUIRED.difference(relative))
        if missing:
            raise RuntimeError(f"Missing HTML App files: {missing}")
        if "NeuroLearn-X.html" in relative:
            raise RuntimeError("The obsolete intermediate NeuroLearn-X.html launcher is present")

        forbidden = [
            name
            for name in relative
            if PurePosixPath(name).name == ".env"
            or PurePosixPath(name).suffix.lower()
            in {".db", ".jks", ".keystore", ".log", ".pyc", ".sqlite", ".sqlite3"}
        ]
        if forbidden:
            raise RuntimeError(f"Private/generated files included: {forbidden}")

        manifest = json.loads(archive.read(relative["package-manifest.json"]))
        if manifest.get("version") != VERSION or manifest.get("frontend_only") is not False:
            raise RuntimeError("Manifest does not identify a full-stack 1.3.1 HTML App")
        if manifest.get("application_route") != "/" or manifest.get("intermediate_page") is not False:
            raise RuntimeError("Manifest does not identify direct frontend serving from /")

        production_names = [
            name
            for name in relative
            if name.startswith("frontend/dist/")
            and PurePosixPath(name).suffix.lower() in {".html", ".js", ".css"}
        ]
        production_text = "\n".join(
            archive.read(relative[name]).decode("utf-8", errors="ignore")
            for name in production_names
        )
        if re.search(r"https?://(?:localhost|127(?:\.\d{1,3}){3})(?::\d+)?", production_text, re.I):
            raise RuntimeError("Compiled production frontend contains a development URL")
        if "/api/health" not in production_text:
            raise RuntimeError("Compiled frontend is missing relative /api/health")

        launcher = archive.read(relative["Start-NeuroLearn-X.ps1"]).decode("utf-8")
        for marker in ("alembic upgrade head", "uvicorn app.main:app", "http://127.0.0.1:$Port/#/"):
            if marker not in launcher:
                raise RuntimeError(f"Direct launcher is missing {marker}")

        backend_main = archive.read(relative["backend/app/main.py"]).decode("utf-8")
        for route in ("/api/health", "/api/auth/login", "/api/student/", "/api/teacher/"):
            if route not in backend_main:
                raise RuntimeError(f"Backend is missing route family {route}")
        if "StaticFiles" not in backend_main or 'app.mount("/"' not in backend_main:
            raise RuntimeError("Backend does not serve the compiled HTML/PWA")

        checksums = archive.read(relative["checksums.txt"]).decode("utf-8").splitlines()
        expected = set(relative).difference({"checksums.txt"})
        checked: set[str] = set()
        for line in checksums:
            match = re.fullmatch(r"([0-9a-f]{64})  \*(.+)", line)
            if not match:
                raise RuntimeError(f"Invalid checksum line: {line}")
            recorded, filename = match.groups()
            if filename not in relative:
                raise RuntimeError(f"Checksum references missing file: {filename}")
            if recorded != digest(archive.read(relative[filename])):
                raise RuntimeError(f"Checksum mismatch: {filename}")
            checked.add(filename)
        if checked != expected:
            raise RuntimeError(f"Checksums do not cover: {sorted(expected - checked)}")

    print("NeuroLearn-X HTML App, full backend, database migrations, PWA, launchers, and checksums are valid.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_path", type=Path)
    args = parser.parse_args()
    validate(args.zip_path)


if __name__ == "__main__":
    main()
