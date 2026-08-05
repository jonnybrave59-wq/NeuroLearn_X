"""Generate deterministic NeuroLearn-X PNG icons without external packages."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def png_bytes(width: int, height: int, pixels: bytearray) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    rows = bytearray()
    stride = width * 4
    for y in range(height):
        rows.append(0)
        rows.extend(pixels[y * stride : (y + 1) * stride])
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + chunk(b"IEND", b"")
    )


def generate(size: int, maskable: bool = False) -> bytes:
    navy = (7, 27, 52, 255)
    cyan = (34, 211, 238, 255)
    light = (207, 250, 254, 255)
    pixels = bytearray(navy * (size * size))

    def set_pixel(x: int, y: int, color: tuple[int, int, int, int]):
        if 0 <= x < size and 0 <= y < size:
            index = (y * size + x) * 4
            pixels[index : index + 4] = bytes(color)

    def disk(cx: float, cy: float, radius: float, color: tuple[int, int, int, int]):
        left, right = max(0, int(cx - radius)), min(size, int(cx + radius + 1))
        top, bottom = max(0, int(cy - radius)), min(size, int(cy + radius + 1))
        squared = radius * radius
        for y in range(top, bottom):
            for x in range(left, right):
                if (x - cx) ** 2 + (y - cy) ** 2 <= squared:
                    set_pixel(x, y, color)

    def line(
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        width: float,
        color: tuple[int, int, int, int],
    ):
        steps = max(1, int(max(abs(x2 - x1), abs(y2 - y1)) * 1.5))
        for step in range(steps + 1):
            ratio = step / steps
            disk(
                x1 + (x2 - x1) * ratio,
                y1 + (y2 - y1) * ratio,
                width / 2,
                color,
            )

    center = size / 2
    safe = 0.31 if maskable else 0.39
    radius = size * safe
    disk(center, center, radius, (10, 53, 88, 255))

    nodes: list[tuple[float, float]] = []
    for ring, count in [(0.16, 6), (0.29, 10)]:
        for index in range(count):
            angle = -math.pi / 2 + (2 * math.pi * index / count)
            nodes.append(
                (
                    center + math.cos(angle) * size * ring,
                    center + math.sin(angle) * size * ring,
                )
            )
    for x, y in nodes:
        line(center, center, x, y, max(2, size * 0.012), cyan)
    for index, (x, y) in enumerate(nodes):
        disk(x, y, max(3, size * 0.025), light if index % 3 == 0 else cyan)
    disk(center, center, max(6, size * 0.055), light)

    # A strong X mark communicates the product name at small icon sizes.
    offset = size * (0.18 if maskable else 0.22)
    x_center = center + offset
    y_center = center + offset
    line(
        x_center - size * 0.055,
        y_center - size * 0.055,
        x_center + size * 0.055,
        y_center + size * 0.055,
        max(3, size * 0.026),
        light,
    )
    line(
        x_center + size * 0.055,
        y_center - size * 0.055,
        x_center - size * 0.055,
        y_center + size * 0.055,
        max(3, size * 0.026),
        light,
    )
    return png_bytes(size, size, pixels)


def save(relative: str, size: int, maskable: bool = False):
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(generate(size, maskable))
    print(destination.relative_to(ROOT))


def splash(width: int, height: int) -> bytes:
    navy = (7, 27, 52, 255)
    pixels = bytearray(navy * (width * height))
    mark_size = max(96, min(width, height) // 3)
    mark_png = generate(mark_size, True)
    cursor = 8
    compressed = bytearray()
    while cursor < len(mark_png):
        length = struct.unpack(">I", mark_png[cursor : cursor + 4])[0]
        kind = mark_png[cursor + 4 : cursor + 8]
        data = mark_png[cursor + 8 : cursor + 8 + length]
        if kind == b"IDAT":
            compressed.extend(data)
        cursor += 12 + length
    raw = zlib.decompress(bytes(compressed))
    mark = bytearray()
    row_size = mark_size * 4
    for y in range(mark_size):
        offset = y * (row_size + 1)
        if raw[offset] != 0:
            raise ValueError("Unexpected PNG filter")
        mark.extend(raw[offset + 1 : offset + 1 + row_size])
    left = (width - mark_size) // 2
    top = (height - mark_size) // 2
    for y in range(mark_size):
        source = y * row_size
        destination = ((top + y) * width + left) * 4
        pixels[destination : destination + row_size] = mark[source : source + row_size]
    return png_bytes(width, height, pixels)


def save_android_assets():
    resource_root = ROOT / "frontend/android/app/src/main/res"
    densities = {
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }
    for density, (icon_size, foreground_size) in densities.items():
        folder = resource_root / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            (folder / name).write_bytes(generate(icon_size))
        (folder / "ic_launcher_foreground.png").write_bytes(
            generate(foreground_size, True)
        )

    splash_sizes = {
        "drawable/splash.png": (480, 320),
        "drawable-land-mdpi/splash.png": (480, 320),
        "drawable-land-hdpi/splash.png": (800, 480),
        "drawable-land-xhdpi/splash.png": (1280, 720),
        "drawable-land-xxhdpi/splash.png": (1600, 960),
        "drawable-land-xxxhdpi/splash.png": (1920, 1280),
        "drawable-port-mdpi/splash.png": (320, 480),
        "drawable-port-hdpi/splash.png": (480, 800),
        "drawable-port-xhdpi/splash.png": (720, 1280),
        "drawable-port-xxhdpi/splash.png": (960, 1600),
        "drawable-port-xxxhdpi/splash.png": (1280, 1920),
    }
    for relative, dimensions in splash_sizes.items():
        destination = resource_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(splash(*dimensions))
    print("frontend/android/app/src/main/res (Android icons and splash screens)")


if __name__ == "__main__":
    save("frontend/public/icons/icon-192.png", 192)
    save("frontend/public/icons/icon-512.png", 512)
    save("frontend/public/icons/icon-maskable-512.png", 512, True)
    save("frontend/public/apple-touch-icon.png", 180)
    save("frontend/public/favicon-32.png", 32)
    if (ROOT / "frontend/android").exists():
        save_android_assets()
