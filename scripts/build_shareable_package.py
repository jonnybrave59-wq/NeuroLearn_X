"""Build the final Windows shareable ZIP from a verified launcher executable."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
LAUNCHER = ROOT / "launcher"
TEMPLATES = LAUNCHER / "templates"
DEFAULT_OUTPUT = ROOT / "release" / "NeuroLearn-X-Shareable.zip"
STAGING_PARENT = LAUNCHER / "build" / "shareable"
STAGING = STAGING_PARENT / "NeuroLearn-X"


def validate_public_url(value: str) -> str:
    value = value.strip().rstrip("/")
    parts = urlsplit(value)
    forbidden = (
        "your-final",
        "your-app",
        "placeholder",
        "example.com",
        ".invalid",
        "localhost",
        "127.0.0.1",
        "<",
        ">",
    )
    if (
        parts.scheme.lower() != "https"
        or not parts.netloc
        or parts.username
        or parts.password
        or parts.query
        or parts.fragment
        or parts.path not in ("", "/")
        or any(marker in value.lower() for marker in forbidden)
    ):
        raise ValueError(
            "Build refused: set a real, clean HTTPS NeuroLearn-X deployment URL."
        )
    return value


def validate_contact(value: str) -> str:
    value = value.strip()
    if (
        not value
        or len(value) > 180
        or "\n" in value
        or "\r" in value
        or any(marker in value.lower() for marker in ("placeholder", "to be supplied"))
        or value.startswith("[")
        or re.search(r"\b(?:STEM\d{3}|TEACHER\d{2})\b", value, flags=re.IGNORECASE)
    ):
        raise ValueError(
            "Build refused: supply a real public researcher contact line."
        )
    return value


def render_template(name: str, values: dict[str, str]) -> str:
    text = (TEMPLATES / name).read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace(f"{{{{{key}}}}}", value)
    unresolved = [token for token in ("{{PUBLIC_URL}}", "{{VERSION}}", "{{RELEASE_DATE}}", "{{CONTACT}}") if token in text]
    if unresolved:
        raise RuntimeError(f"Unresolved template values in {name}: {unresolved}")
    return text


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_checksums() -> None:
    paths = sorted(
        (path for path in STAGING.rglob("*") if path.is_file() and path.name != "checksums.txt"),
        key=lambda path: path.relative_to(STAGING).as_posix(),
    )
    lines = [
        f"{sha256(path)}  *{path.relative_to(STAGING).as_posix()}"
        for path in paths
    ]
    (STAGING / "checksums.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def create_zip(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source in sorted(STAGING.rglob("*")):
            if not source.is_file():
                continue
            relative = source.relative_to(STAGING).as_posix()
            info = zipfile.ZipInfo(f"NeuroLearn-X/{relative}")
            info.date_time = (2026, 8, 2, 12, 0, 0)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, source.read_bytes())


def build(
    public_url: str,
    executable: Path,
    output: Path,
    *,
    version: str,
    release_date: str,
    contact: str,
) -> None:
    public_url = validate_public_url(public_url)
    contact = validate_contact(contact)
    executable = executable.resolve()
    if (
        not executable.is_file()
        or executable.stat().st_size < 100_000
        or executable.read_bytes()[:2] != b"MZ"
    ):
        raise RuntimeError(
            "Build refused: a genuine Windows Open NeuroLearn-X.exe was not supplied."
        )
    if not (LAUNCHER / "assets" / "neurolearnx.ico").is_file():
        raise RuntimeError("Run scripts/generate_launcher_assets.py first.")

    from generate_quick_guide import generate as generate_quick_guide

    resolved_parent = STAGING_PARENT.resolve()
    resolved_stage = STAGING.resolve()
    if resolved_parent not in resolved_stage.parents:
        raise RuntimeError("Unsafe staging path")
    if STAGING_PARENT.exists():
        shutil.rmtree(STAGING_PARENT)
    (STAGING / "icons").mkdir(parents=True)

    shutil.copy2(executable, STAGING / "Open NeuroLearn-X.exe")
    shutil.copy2(TEMPLATES / "LICENSE.txt", STAGING / "LICENSE.txt")
    shutil.copy2(
        LAUNCHER / "assets" / "neurolearnx.ico",
        STAGING / "icons" / "neurolearnx.ico",
    )
    for name in ("icon-192.png", "icon-512.png", "icon-maskable-512.png"):
        shutil.copy2(
            ROOT / "frontend" / "public" / "icons" / name,
            STAGING / "icons" / name,
        )

    values = {
        "PUBLIC_URL": public_url,
        "VERSION": version,
        "RELEASE_DATE": release_date,
        "CONTACT": contact,
    }
    (STAGING / "Open NeuroLearn-X.bat").write_text(
        render_template("Open NeuroLearn-X.bat.template", values),
        encoding="utf-8",
        newline="\r\n",
    )
    (STAGING / "Open NeuroLearn-X.url").write_text(
        render_template("Open NeuroLearn-X.url.template", values),
        encoding="utf-8",
        newline="\r\n",
    )
    (STAGING / "README-FIRST.txt").write_text(
        render_template("README-FIRST.txt.template", values),
        encoding="utf-8",
        newline="\r\n",
    )
    (STAGING / "version.txt").write_text(
        f"NeuroLearn-X\nVersion: {version}\nRelease date: {release_date}\n",
        encoding="utf-8",
    )
    (STAGING / "launcher-config.json").write_text(
        json.dumps(
            {
                "appName": "NeuroLearn-X",
                "productionUrl": public_url,
                "version": version,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    generate_quick_guide(
        public_url,
        STAGING / "NeuroLearn-X-Quick-Guide.pdf",
        STAGING / "QR-Code.png",
        version=version,
        release_date=release_date,
        contact=contact,
    )
    write_checksums()
    create_zip(output)
    print(f"Created {output.relative_to(ROOT)} ({output.stat().st_size:,} bytes)")
    print(f"SHA-256 {sha256(output)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--production-url", required=True)
    parser.add_argument("--exe", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--version", default="1.3.1")
    parser.add_argument("--release-date", default="August 2, 2026")
    parser.add_argument(
        "--contact",
        required=True,
    )
    arguments = parser.parse_args()
    build(
        arguments.production_url,
        arguments.exe,
        arguments.output,
        version=arguments.version,
        release_date=arguments.release_date,
        contact=arguments.contact,
    )


if __name__ == "__main__":
    main()
