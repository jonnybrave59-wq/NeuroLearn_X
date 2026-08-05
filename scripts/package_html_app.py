"""Create the full-stack NeuroLearn-X HTML App distribution."""

from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

from package_full_system import FIXED_TIME, RELEASE, ROOT, VERSION, digest, package_files


OUTPUT = RELEASE / "NeuroLearn-X-HTML-App.zip"
PREFIX = "NeuroLearn-X-HTML-App/"


def html_app_files() -> dict[str, bytes]:
    files = package_files()
    for source in sorted(path for path in (ROOT / "html-app").rglob("*") if path.is_file()):
        files[source.relative_to(ROOT / "html-app").as_posix()] = source.read_bytes()

    manifest = json.loads(files["package-manifest.json"])
    manifest.update(
        {
            "name": "NeuroLearn-X HTML App",
            "application_entry": "frontend/dist/index.html",
            "application_route": "/",
            "browser_url": "http://127.0.0.1:8021/#/",
            "one_click_windows_launcher": "Start-NeuroLearn-X-HTML-App.bat",
            "intermediate_page": False,
            "frontend_only": False,
        }
    )
    files["package-manifest.json"] = (
        json.dumps(manifest, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    files["version.txt"] = f"NeuroLearn-X HTML App {VERSION}\n".encode("utf-8")
    return files


def validate_inputs(files: dict[str, bytes]) -> None:
    required = {
        "README-HTML-APP.md",
        "Start-NeuroLearn-X-HTML-App.bat",
        "Start-NeuroLearn-X-HTML-App.ps1",
        "Start-NeuroLearn-X-HTML-App.sh",
        "Start-NeuroLearn-X.bat",
        "Setup-NeuroLearn-X.bat",
        "backend/app/main.py",
        "backend/app/tutoring.py",
        "backend/alembic/versions/0004_intelligent_tutoring.py",
        "frontend/dist/index.html",
        "frontend/dist/manifest.webmanifest",
        "frontend/dist/sw.js",
    }
    missing = sorted(required.difference(files))
    if missing:
        raise RuntimeError(f"HTML App inputs are incomplete: {missing}")
    if "NeuroLearn-X.html" in files:
        raise RuntimeError("The obsolete intermediate NeuroLearn-X.html launcher is still included")

    production_text = b"\n".join(
        data
        for name, data in files.items()
        if name.startswith("frontend/dist/")
        and Path(name).suffix.lower() in {".html", ".js", ".css"}
    ).decode("utf-8", errors="ignore")
    if "http://localhost" in production_text or "http://127.0.0.1" in production_text:
        raise RuntimeError("The compiled production HTML contains a development URL")
    if "/api/health" not in production_text:
        raise RuntimeError("The compiled production HTML is missing the relative health route")

    launcher = files["Start-NeuroLearn-X.ps1"].decode("utf-8")
    for marker in (
        "alembic upgrade head",
        "uvicorn app.main:app",
        "http://127.0.0.1:$Port/#/",
    ):
        if marker not in launcher:
            raise RuntimeError(f"Direct launcher is missing {marker}")


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
    files = html_app_files()
    validate_inputs(files)
    archive_digest = write_archive(files)
    print(f"Created {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")
    print(f"SHA-256 {archive_digest}")


if __name__ == "__main__":
    main()
