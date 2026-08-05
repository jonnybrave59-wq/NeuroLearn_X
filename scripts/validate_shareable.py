"""Validate the completed Windows launcher ZIP without trusting its contents."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import zipfile
from pathlib import PurePosixPath
from urllib.parse import urlsplit

from pypdf import PdfReader


PREFIX = "NeuroLearn-X/"
REQUIRED = {
    "Open NeuroLearn-X.exe",
    "Open NeuroLearn-X.bat",
    "Open NeuroLearn-X.url",
    "README-FIRST.txt",
    "NeuroLearn-X-Quick-Guide.pdf",
    "QR-Code.png",
    "version.txt",
    "LICENSE.txt",
    "launcher-config.json",
    "checksums.txt",
    "icons/neurolearnx.ico",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-512.png",
}
TEXT_FILES = {
    "Open NeuroLearn-X.bat",
    "Open NeuroLearn-X.url",
    "README-FIRST.txt",
    "version.txt",
    "LICENSE.txt",
    "launcher-config.json",
    "checksums.txt",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate(path) -> None:
    with zipfile.ZipFile(path) as archive:
        damaged = archive.testzip()
        if damaged:
            raise RuntimeError(f"Damaged ZIP entry: {damaged}")
        names = archive.namelist()
        if any(not name.startswith(PREFIX) for name in names):
            raise RuntimeError("Every shareable file must be inside NeuroLearn-X/")
        relative = {
            name.removeprefix(PREFIX): name
            for name in names
            if name != PREFIX and not name.endswith("/")
        }
        missing = sorted(REQUIRED.difference(relative))
        if missing:
            raise RuntimeError(f"Missing shareable files: {missing}")
        unexpected = sorted(set(relative).difference(REQUIRED))
        if unexpected:
            raise RuntimeError(f"Unexpected shareable files: {unexpected}")

        config = json.loads(archive.read(relative["launcher-config.json"]))
        public_url = str(config.get("productionUrl", "")).strip().rstrip("/")
        parts = urlsplit(public_url)
        if (
            parts.scheme.lower() != "https"
            or not parts.netloc
            or parts.username
            or parts.password
            or parts.query
            or parts.fragment
            or parts.path not in ("", "/")
        ):
            raise RuntimeError("Launcher URL is not a clean HTTPS origin")
        if any(
            marker in public_url.lower()
            for marker in (
                "placeholder",
                "example.com",
                ".invalid",
                "your-final",
                "your-app",
                "localhost",
                "127.0.0.1",
            )
        ):
            raise RuntimeError("Launcher URL is still a placeholder")

        executable = archive.read(relative["Open NeuroLearn-X.exe"])
        if executable[:2] != b"MZ" or len(executable) < 100_000:
            raise RuntimeError("Open NeuroLearn-X.exe is not a plausible Windows executable")

        for name in TEXT_FILES:
            text = archive.read(relative[name]).decode("utf-8-sig", errors="strict")
            if name in {"Open NeuroLearn-X.bat", "Open NeuroLearn-X.url", "README-FIRST.txt"}:
                if public_url not in text:
                    raise RuntimeError(f"{name} does not use the configured public URL")
            lowered = text.lower()
            if any(secret in lowered for secret in ("secret_key=", "database_url=", "postgresql://", "password=")):
                raise RuntimeError(f"Potential secret found in {name}")
            if re.search(r"\b(?:STEM\d{3}|TEACHER\d{2})\b", text, flags=re.IGNORECASE):
                raise RuntimeError(f"Participant information found in {name}")

        pdf_text = "\n".join(
            page.extract_text() or ""
            for page in PdfReader(
                io.BytesIO(archive.read(relative["NeuroLearn-X-Quick-Guide.pdf"]))
            ).pages
        )
        if public_url not in pdf_text or "HOW TO OPEN NEUROLEARN-X" not in pdf_text:
            raise RuntimeError("Quick Guide PDF is missing required public instructions")

        checksums = archive.read(relative["checksums.txt"]).decode("utf-8").splitlines()
        expected_files = set(relative).difference({"checksums.txt"})
        checked_files: set[str] = set()
        for line in checksums:
            match = re.fullmatch(r"([0-9a-f]{64})  \*(.+)", line)
            if not match:
                raise RuntimeError(f"Invalid checksum line: {line}")
            recorded, filename = match.groups()
            if filename not in relative:
                raise RuntimeError(f"Checksum references missing file: {filename}")
            if recorded != digest(archive.read(relative[filename])):
                raise RuntimeError(f"Checksum mismatch: {filename}")
            checked_files.add(filename)
        if checked_files != expected_files:
            raise RuntimeError(
                f"Checksums do not cover every file: {sorted(expected_files - checked_files)}"
            )

        forbidden_suffixes = {
            ".db",
            ".env",
            ".jks",
            ".keystore",
            ".log",
            ".sqlite",
            ".sqlite3",
        }
        forbidden = [
            name
            for name in relative
            if PurePosixPath(name).name == ".env"
            or PurePosixPath(name).suffix.lower() in forbidden_suffixes
        ]
        if forbidden:
            raise RuntimeError(f"Forbidden private files included: {forbidden}")

    print("Shareable ZIP, HTTPS configuration, privacy scan, and checksums are valid.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_path")
    arguments = parser.parse_args()
    validate(arguments.zip_path)


if __name__ == "__main__":
    main()
