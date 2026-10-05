"""Re-check every recovered figure for colour that an older crop threshold dropped (offline).

  py scripts/recovery/recolour.py [--apply]

For each figure in src/data/sources/*.json, re-crops its stored box from the cached render of the ORIGINAL page.
If the source crop has colour (page.has_colour) but the stored PNG is greyscale, it lists it; with --apply it
rewrites the PNG in colour from the same box (same pixels, colour kept). Width/height in the pack are updated
only if they change. Needs the source PDF, found through .sources-cache/p51/held.json.
"""
import glob
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import page  # noqa: E402

ROOT = page.ROOT
apply = "--apply" in sys.argv
# --requantize: also rewrite every colour figure from its box with the full 256-colour palette (older crops used 64).
requant = "--requantize" in sys.argv
held = json.load(open(os.path.join(ROOT, ".sources-cache", "p51", "held.json"), encoding="utf8"))
pdf_of = {}
for row in held:
    if row.get("pdf"):
        pdf_of.setdefault(row["pack"], os.path.join(ROOT, row["pdf"]))


def is_grey(path):
    im = Image.open(path)
    if im.mode in ("L", "LA", "1"):
        return True
    if im.mode == "P":
        pal = im.getpalette()[: 3 * 256]
        used = {i for _, i in im.getcolors(256) or []}
        return all(pal[3 * i] == pal[3 * i + 1] == pal[3 * i + 2] for i in used)
    rgb = im.convert("RGB")
    return not page.has_colour(rgb)


found = changed = missing = 0
for pf in sorted(glob.glob(os.path.join(ROOT, "src", "data", "sources", "*.json"))):
    pack = json.load(open(pf, encoding="utf8"))
    key = pack["source"]["key"]
    dirty = False
    for q in pack["questions"]:
        for f in q.get("figures") or []:
            png = os.path.join(ROOT, "public", f["src"].lstrip("/"))
            if not os.path.exists(png):
                continue
            grey = is_grey(png)
            if not grey and not requant:
                continue
            pdf = pdf_of.get(key)
            if not pdf or not os.path.exists(pdf):
                missing += 1
                continue
            img = page.render(pdf, f["page"])
            w, h = img.size
            c = f["crop"]
            part = img.crop((round(c["x"] * w), round(c["y"] * h), round((c["x"] + c["w"]) * w), round((c["y"] + c["h"]) * h)))
            if not page.has_colour(part):
                continue
            found += 1
            if grey:
                print(f"{key} {f['src']} p{f['page']}: source has colour, stored PNG is greyscale")
            if apply:
                final = part.quantize(256)
                if final.width > 1400:
                    final = final.convert("RGB").resize((1400, round(final.height * 1400 / final.width)), Image.LANCZOS).quantize(256)
                final.save(png, optimize=True)
                if (f["width"], f["height"]) != final.size:
                    f["width"], f["height"] = final.size
                    dirty = True
                changed += 1
    if dirty:
        with open(pf, "w", encoding="utf8", newline="\n") as fh:
            fh.write(json.dumps(pack, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"colourLost": found, "rewritten": changed, "noPdf": missing}))
