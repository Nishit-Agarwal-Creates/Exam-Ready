"""Source-page tools for the recovery pipeline (offline; never runs in the Worker).

  py scripts/recovery/page.py grid <pdf> <page> <out.png>
      Render one PDF page (1-based) with a labelled grid every 5 % of the page, so a figure's box can be read off
      as fractions of the page. Renders are cached under .sources-cache/p51/pages/.

  py scripts/recovery/page.py crop <pdf> <page> <x> <y> <w> <h> <out.png> [--zoom]
      Crop the box (fractions of the page, 0-1, from the top-left) out of a high-resolution render of the ORIGINAL
      page and save it as a compact PNG (greyscale when the crop has no colour). Prints JSON with the pixel size.
      Nothing is redrawn: the pixels are the source page's own. --zoom also writes <out>.check.png at 2x for checking.

Requires pypdfium2 and Pillow.
"""
import hashlib
import json
import os
import sys

import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, ".sources-cache", "p51", "pages")
SCALE = 3.0  # ~216 dpi: labels and thin lines stay legible


def render(pdf, page):
    os.makedirs(CACHE, exist_ok=True)
    h = hashlib.sha256(open(pdf, "rb").read()).hexdigest()[:16]
    path = os.path.join(CACHE, f"{h}-p{page}-x{SCALE:g}.png")
    if not os.path.exists(path):
        doc = pdfium.PdfDocument(pdf)
        img = doc[page - 1].render(scale=SCALE).to_pil().convert("RGB")
        img.save(path)
    return Image.open(path).convert("RGB")


def grid(pdf, page, out):
    img = render(pdf, page)
    w, h = img.size
    small = img.resize((w // 2, h // 2))
    d = ImageDraw.Draw(small)
    sw, sh = small.size
    try:
        font = ImageFont.truetype("arial.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    for i in range(0, 101, 5):
        x = round(sw * i / 100)
        y = round(sh * i / 100)
        strong = i % 10 == 0
        col = (220, 0, 0) if strong else (255, 150, 150)
        d.line([(x, 0), (x, sh)], fill=col, width=2 if strong else 1)
        d.line([(0, y), (sw, y)], fill=col, width=2 if strong else 1)
        if strong:
            d.text((x + 2, 2), str(i), fill=(200, 0, 0), font=font)
            d.text((2, y + 2), str(i), fill=(200, 0, 0), font=font)
    small.save(out)
    print(json.dumps({"out": out, "page": page, "size": [w, h]}))


def has_colour(part):
    """Greyscale only when there is no real colour (most scans and line art): smaller files, identical content.
    Colour is kept whenever even a thin coloured line is present (a red curve, a coloured label, map tints):
    at least 0.1 % of the pixels, and at least 150 pixels, clearly coloured."""
    hist = part.convert("HSV").split()[1].histogram()
    n = sum(hist[60:])
    return n >= 150 and n / max(1, part.width * part.height) > 0.001


def crop(pdf, page, x, y, cw, ch, out, zoom=False):
    for v in (x, y, cw, ch):
        if not 0 <= v <= 1:
            raise SystemExit("box values must be fractions of the page (0-1)")
    if x + cw > 1.0001 or y + ch > 1.0001 or cw < 0.02 or ch < 0.01:
        raise SystemExit("box falls outside the page or is too small")
    img = render(pdf, page)
    w, h = img.size
    box = (round(x * w), round(y * h), round((x + cw) * w), round((y + ch) * h))
    part = img.crop(box)
    final = part.quantize(256) if has_colour(part) else part.convert("L").quantize(32)
    if final.width > 1400:
        final = final.convert("RGB").resize((1400, round(final.height * 1400 / final.width)), Image.LANCZOS).quantize(256)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    final.save(out, optimize=True)
    if zoom:
        part.resize((part.width * 2 // 3, part.height * 2 // 3)).save(out + ".check.png")
    print(json.dumps({"out": out, "page": page, "crop": {"x": x, "y": y, "w": cw, "h": ch}, "width": final.width, "height": final.height, "bytes": os.path.getsize(out)}))


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__)
    elif a[0] == "grid":
        grid(a[1], int(a[2]), a[3])
    elif a[0] == "crop":
        crop(a[1], int(a[2]), float(a[3]), float(a[4]), float(a[5]), float(a[6]), a[7], zoom="--zoom" in a)
    else:
        print(__doc__)
