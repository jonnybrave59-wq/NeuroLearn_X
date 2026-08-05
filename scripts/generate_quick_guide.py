"""Generate the public NeuroLearn-X quick guide PDF and QR code."""

from __future__ import annotations

import argparse
from pathlib import Path
from urllib.parse import urlsplit

import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
NAVY = colors.HexColor("#071B34")
CYAN = colors.HexColor("#16B8D4")
SLATE = colors.HexColor("#475569")
LIGHT = colors.HexColor("#F3F7FA")


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
        raise ValueError("A real, clean HTTPS NeuroLearn-X deployment URL is required")
    return value


def wrap(text: str, font: str, size: float, width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and stringWidth(candidate, font, size) > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def draw_wrapped(
    pdf: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    *,
    font: str = "Helvetica",
    size: float = 9.5,
    leading: float = 13,
    color=SLATE,
) -> float:
    pdf.setFont(font, size)
    pdf.setFillColor(color)
    for line in wrap(text, font, size, width):
        pdf.drawString(x, y, line)
        y -= leading
    return y


def generate(
    public_url: str,
    output_pdf: Path,
    output_qr: Path,
    *,
    version: str,
    release_date: str,
    contact: str,
) -> None:
    public_url = validate_public_url(public_url)
    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    output_qr.parent.mkdir(parents=True, exist_ok=True)

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=12,
        border=4,
    )
    qr.add_data(public_url)
    qr.make(fit=True)
    qr_image = qr.make_image(fill_color="#071B34", back_color="white")
    qr_image.save(output_qr)

    page_width, page_height = letter
    pdf = canvas.Canvas(str(output_pdf), pagesize=letter)
    pdf.setTitle("NeuroLearn-X Quick Guide")
    pdf.setAuthor("NeuroLearn-X Research Team")
    pdf.setSubject("Safe installation and login instructions")

    pdf.setFillColor(LIGHT)
    pdf.rect(0, 0, page_width, page_height, fill=1, stroke=0)
    pdf.setFillColor(NAVY)
    pdf.rect(0, page_height - 126, page_width, 126, fill=1, stroke=0)

    icon_path = ROOT / "frontend" / "public" / "icons" / "icon-192.png"
    pdf.drawImage(
        ImageReader(str(icon_path)),
        42,
        page_height - 105,
        width=68,
        height=68,
        mask="auto",
    )
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 25)
    pdf.drawString(126, page_height - 63, "NeuroLearn-X Quick Guide")
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(colors.HexColor("#CDEEF5"))
    pdf.drawString(127, page_height - 84, f"Version {version}  |  Released {release_date}")

    left = 42
    y = page_height - 160
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(left, y, "HOW TO OPEN NEUROLEARN-X")
    y -= 25

    steps = [
        "Right-click NeuroLearn-X-Shareable.zip.",
        "Select Extract All.",
        "Open the extracted folder.",
        "Double-click Open NeuroLearn-X.exe.",
        "If Windows displays a warning, verify that the file came from the official researchers before continuing.",
        "Log in using your assigned Student or Teacher account.",
    ]
    for index, step in enumerate(steps, start=1):
        pdf.setFillColor(CYAN)
        pdf.circle(left + 8, y + 3, 8, fill=1, stroke=0)
        pdf.setFillColor(NAVY)
        pdf.setFont("Helvetica-Bold", 8.5)
        pdf.drawCentredString(left + 8, y, str(index))
        y = draw_wrapped(pdf, step, left + 24, y + 1, 360, size=9.5, leading=12)
        y -= 7

    box_y = y - 3
    pdf.setFillColor(colors.white)
    pdf.roundRect(left, box_y - 62, 385, 62, 10, fill=1, stroke=0)
    pdf.setStrokeColor(colors.HexColor("#BAE6FD"))
    pdf.roundRect(left, box_y - 62, 385, 62, 10, fill=0, stroke=1)
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(left + 14, box_y - 19, "Internet connection required")
    draw_wrapped(
        pdf,
        "NeuroLearn-X uses a secure online database and recommendation server. The launcher never places passwords or authentication tokens in the public URL.",
        left + 14,
        box_y - 36,
        355,
        size=8.5,
        leading=10.5,
    )

    qr_x = 454
    qr_y = page_height - 348
    pdf.setFillColor(colors.white)
    pdf.roundRect(qr_x - 12, qr_y - 42, 128, 168, 14, fill=1, stroke=0)
    pdf.drawImage(
        ImageReader(str(output_qr)),
        qr_x,
        qr_y,
        width=104,
        height=104,
        mask="auto",
    )
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawCentredString(qr_x + 52, qr_y - 17, "Scan to open the app")
    pdf.setFont("Helvetica", 7)
    pdf.setFillColor(SLATE)
    pdf.drawCentredString(qr_x + 52, qr_y - 30, "Public HTTPS link only")

    section_y = box_y - 91
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(left, section_y, "Public web link")
    section_y = draw_wrapped(
        pdf,
        public_url,
        left,
        section_y - 16,
        page_width - 84,
        font="Helvetica-Bold",
        size=8.5,
        leading=11,
        color=CYAN,
    )

    section_y -= 8
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(left, section_y, "Supported devices")
    section_y -= 17
    devices = [
        "Windows 10/11: portable launcher, Chrome, or Edge",
        "Android: Chrome or installed PWA",
        "iPhone/iPad: Safari, then Share > Add to Home Screen",
        "macOS/Linux/ChromeOS: current modern browser",
    ]
    for device in devices:
        pdf.setFillColor(CYAN)
        pdf.circle(left + 3, section_y + 3, 2.5, fill=1, stroke=0)
        section_y = draw_wrapped(
            pdf,
            device,
            left + 12,
            section_y,
            455,
            size=8.7,
            leading=11,
        )
        section_y -= 2

    section_y -= 4
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(left, section_y, "Login and privacy")
    section_y = draw_wrapped(
        pdf,
        "Use only the participant code and password assigned by the authorized research team. Do not share credentials. Sign out after use, especially on a shared device. Demo predictions are not research findings or medical or psychological diagnoses.",
        left,
        section_y - 17,
        page_width - 84,
        size=8.7,
        leading=11,
    )

    section_y -= 6
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(left, section_y, "Researcher contact")
    draw_wrapped(
        pdf,
        contact,
        left + 96,
        section_y,
        page_width - left - 138,
        size=8.7,
        leading=11,
    )

    pdf.setFillColor(NAVY)
    pdf.rect(0, 0, page_width, 28, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawString(left, 10, "NeuroLearn-X - Explainable adaptive learning research prototype")
    pdf.drawRightString(page_width - left, 10, "Page 1 of 1")
    pdf.save()
    print(f"Created {output_pdf}")
    print(f"Created {output_qr}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--public-url", required=True)
    parser.add_argument("--output-pdf", type=Path, required=True)
    parser.add_argument("--output-qr", type=Path, required=True)
    parser.add_argument("--version", default="1.3.0")
    parser.add_argument("--release-date", default="August 2, 2026")
    parser.add_argument(
        "--contact",
        default="[Researcher contact to be supplied before public distribution]",
    )
    arguments = parser.parse_args()
    generate(
        arguments.public_url,
        arguments.output_pdf,
        arguments.output_qr,
        version=arguments.version,
        release_date=arguments.release_date,
        contact=arguments.contact,
    )


if __name__ == "__main__":
    main()
