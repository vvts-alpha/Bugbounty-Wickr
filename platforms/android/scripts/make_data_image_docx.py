from __future__ import annotations

import base64
import hashlib
import io
import zipfile
from pathlib import Path

from docx import Document
from lxml import etree
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "poc-preview-file-marker-v2.docx"
OUTPUT = ROOT / "poc-data-image-marker.docx"


def make_png() -> bytes:
    image = Image.new("RGB", (360, 140), "#176B87")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (6, 6, 353, 133),
        radius=18,
        fill="#1F8A70",
        outline="#F9F54B",
        width=6,
    )
    font = ImageFont.load_default(size=24)
    text = "DATA IMAGE OK"
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (image.width - (bbox[2] - bbox[0])) // 2
    y = (image.height - (bbox[3] - bbox[1])) // 2
    draw.text((x, y), text, font=font, fill="white")

    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def build_html(png: bytes) -> bytes:
    encoded = base64.b64encode(png).decode("ascii")
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>DOCX_DATA_IMAGE_TEST</title>
</head>
<body>
  <p>ALTCHUNK DATA URI IMAGE TEST</p>
  <img
    src="data:image/png;base64,{encoded}"
    width="360"
    height="140"
    alt="DATA_URI_IMAGE_FAILED">
</body>
</html>
""".encode("utf-8")


def create() -> None:
    html = build_html(make_png())
    with zipfile.ZipFile(SOURCE, "r") as source:
        with zipfile.ZipFile(
            OUTPUT, "w", compression=zipfile.ZIP_DEFLATED
        ) as destination:
            for item in source.infolist():
                if item.filename == "word/afchunk.html":
                    destination.writestr(item, html)
                else:
                    destination.writestr(item, source.read(item))


def verify() -> None:
    with zipfile.ZipFile(OUTPUT, "r") as archive:
        bad_entry = archive.testzip()
        if bad_entry:
            raise RuntimeError(f"bad ZIP entry: {bad_entry}")

        for name in archive.namelist():
            if name.endswith(".xml") or name.endswith(".rels"):
                etree.fromstring(archive.read(name))

        html = archive.read("word/afchunk.html")
        required = (
            b"ALTCHUNK DATA URI IMAGE TEST",
            b"data:image/png;base64,",
            b"DATA_URI_IMAGE_FAILED",
        )
        if not all(marker in html for marker in required):
            raise RuntimeError("required data-image markers are missing")
        if b"<script" in html.lower():
            raise RuntimeError("script content is not permitted")

    Document(OUTPUT)
    digest = hashlib.sha256(OUTPUT.read_bytes()).hexdigest().upper()
    print(f"output={OUTPUT}")
    print(f"size={OUTPUT.stat().st_size}")
    print(f"sha256={digest}")


def main() -> None:
    create()
    verify()


if __name__ == "__main__":
    main()
