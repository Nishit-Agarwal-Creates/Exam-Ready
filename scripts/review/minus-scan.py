# Finds minus signs that a PDF draws as tiny filled rectangles instead of text. Every pdftotext mode drops these,
# so a stored "2·0" may really be "−2·0". For each source pack in src/data/sources, this locates the original PDF in
# .sources-cache (by SHA-256), finds drawn bars that sit on a text line with a character immediately to their right
# (a fraction bar has text above and below instead), and flags every question on that page (±1) whose stored text,
# options or answer contain the token after the bar without a minus in front of it.
#
#   py scripts/review/minus-scan.py            writes src/data/reviews/minus-scan.json
#
# Consolidation holds every flagged key (HOLD_AUDIT) until a reviewer clears it. Conservative on purpose: a false
# positive only holds a question; a miss could publish a wrong sign.
import hashlib, json, os, re, sys
import pdfplumber

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SOURCES = os.path.join(ROOT, "src", "data", "sources")
CACHE = os.path.join(ROOT, ".sources-cache")
OUT = os.path.join(ROOT, "src", "data", "reviews", "minus-scan.json")


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def key_of(source_key, q):
    part = re.sub(r"[^a-z0-9ivx]", "", q.get("part") or "", flags=re.I)
    return f"{source_key}#{q['number']}{part}"


def drawn_minus_tokens(page):
    """Tokens that follow a drawn minus bar on this page, e.g. '2·0', '3', 'q'."""
    chars = [c for c in page.chars if c["text"].strip()]
    bars = [r for r in page.rects + page.lines if (r["bottom"] - r["top"]) < 2 and 2 < (r["x1"] - r["x0"]) < 12]
    tokens = []
    for r in bars:
        mid = (r["top"] + r["bottom"]) / 2
        # Text above and below overlapping the bar → a fraction bar, not a minus.
        over = [c for c in chars if c["x1"] > r["x0"] and c["x0"] < r["x1"]]
        above = any(c["bottom"] <= mid + 0.5 and mid - c["bottom"] < 8 for c in over)
        below = any(c["top"] >= mid - 0.5 and c["top"] - mid < 8 for c in over)
        if above and below:
            continue
        # A character must start just right of the bar, on the same line (its vertical span covers the bar).
        # A minus sits at mid-height of the text; an underline or rule sits at the bottom edge.
        right = sorted(
            (c for c in chars if -0.5 <= c["x0"] - r["x1"] < 7 and c["top"] + 0.25 * (c["bottom"] - c["top"]) <= mid <= c["bottom"] - 0.25 * (c["bottom"] - c["top"])),
            key=lambda c: c["x0"],
        )
        if not right:
            continue
        line = sorted((c for c in chars if abs((c["top"] + c["bottom"]) / 2 - (right[0]["top"] + right[0]["bottom"]) / 2) < 2.5 and c["x0"] >= right[0]["x0"]), key=lambda c: c["x0"])
        tok, px = "", None
        for c in line:
            if px is not None and c["x0"] - px > 1.5:
                break
            tok += c["text"]
            px = c["x1"]
        tok = tok.strip()
        # Only what a minus can precede: a number, a single-letter variable, or a bracket, e.g. "2·0", "x", "(3".
        if tok and re.match(r"^(\d|[A-Za-z](?![A-Za-z]{2})|\()", tok):
            tokens.append(tok[:12])
    return tokens


def main():
    by_sha = {}
    for d, _, files in os.walk(CACHE):
        for f in files:
            if f.lower().endswith(".pdf"):
                p = os.path.join(d, f)
                try:
                    by_sha.setdefault(sha(p), p)
                except OSError:
                    pass
    flags, scanned, missing = [], [], []
    for f in sorted(os.listdir(SOURCES)):
        if not f.endswith(".json"):
            continue
        pack = json.load(open(os.path.join(SOURCES, f), encoding="utf8"))
        src = pack["source"]
        pdf_path = by_sha.get(src.get("sha256", ""))
        if not pdf_path:
            missing.append(src["key"])
            continue
        tokens_by_page = {}
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                t = drawn_minus_tokens(page)
                if t:
                    tokens_by_page[i] = t
        scanned.append({"pack": src["key"], "pagesWithDrawnMinus": len(tokens_by_page)})
        for q in pack["questions"]:
            if not q.get("chapter"):
                continue
            p = q.get("page") or 0
            toks = [t for pg in (p - 1, p, p + 1) for t in tokens_by_page.get(pg, [])]
            ans = q.get("officialAnswer") or {}
            body = " ".join([q.get("text") or "", *(q.get("options") or []), ans.get("text") or ""])
            for t in toks:
                # Look for the token without a minus-like character right before it.
                esc = re.escape(t)
                for m in re.finditer(esc, body):
                    before = body[max(0, m.start() - 2) : m.start()]
                    if not re.search(r"[−\-–⁻₋]\s?$", before):
                        flags.append({"key": key_of(src["key"], q), "token": t, "page": p})
                        break
                else:
                    continue
                break
    json.dump(
        {"note": "Questions whose page shows a minus sign drawn as a shape (dropped by text extraction) before a token their stored text has without a minus. Held until a reviewer clears them.", "scanned": scanned, "missingPdf": missing, "flags": flags},
        open(OUT, "w", encoding="utf8", newline="\n"),
        ensure_ascii=False,
        indent=2,
    )
    print(f"scanned {len(scanned)} packs ({len(missing)} without a cached PDF), {len(flags)} questions flagged → {os.path.relpath(OUT, ROOT)}")
    for s in scanned:
        if s["pagesWithDrawnMinus"]:
            n = sum(1 for fl in flags if fl["key"].startswith(s["pack"] + "#"))
            print(f"  {s['pack']}: {s['pagesWithDrawnMinus']} pages with drawn minus signs, {n} questions flagged")


if __name__ == "__main__":
    sys.exit(main())
