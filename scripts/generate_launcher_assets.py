"""Generate the Windows launcher icon from the canonical PWA icon."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend" / "public" / "icons" / "icon-512.png"
OUTPUT = ROOT / "launcher" / "assets" / "neurolearnx.ico"


def main() -> None:
    if not SOURCE.is_file():
        raise RuntimeError(f"Missing canonical app icon: {SOURCE}")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE) as image:
        image.convert("RGBA").save(
            OUTPUT,
            format="ICO",
            sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
        )
    if OUTPUT.read_bytes()[:4] != b"\x00\x00\x01\x00":
        raise RuntimeError("Generated launcher icon is not a valid ICO file")
    print(f"Created {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
