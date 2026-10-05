// Phase 5.1 recovery inventory: classifies every held question by what would be needed to recover it, from the
// evidence already on disk (packs, reviews, audits, consolidation summary and the locally cached source PDFs).
// It changes nothing; it writes .sources-cache/p51/held.json and prints counts.
//
//   node scripts/recovery/inventory.mjs
//
// Categories (a question can have several):
//   FIGURE / TABLE / GRAPH / MAP / PASSAGE   the reviewer held it because something on the page is not in the text
//   OCR            text, options or notation don't match the page (or a power is written flat)
//   MARKS          marks not printed / inferred / split / fractional / unconfirmed
//   CHAPTER        chapter uncertain (GROUP_SPANS: one entry covers several chapters)
//   ANSWER         official answer looks wrong or doesn't match
//   AUDIT          disputed by, or waiting for, the independent audit
//   NO_PDF         the source PDF is not available locally (nothing can be recovered from the page)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decide } from "../review/consolidate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cacheDir = join(root, ".sources-cache");
const outDir = join(cacheDir, "p51");
mkdirSync(outDir, { recursive: true });

// --- index every local PDF by SHA-256 (cached by path + size + mtime) -------------------------------
const hashCacheFile = join(outDir, "pdf-hashes.json");
const hashCache = existsSync(hashCacheFile) ? JSON.parse(readFileSync(hashCacheFile, "utf8")) : {};
const byHash = new Map();
function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.pdf$/i.test(e.name)) {
      const st = statSync(p);
      const sig = `${st.size}:${st.mtimeMs}`;
      let h = hashCache[p]?.sig === sig ? hashCache[p].hash : null;
      if (!h) {
        h = createHash("sha256").update(readFileSync(p)).digest("hex");
        hashCache[p] = { sig, hash: h };
      }
      if (!byHash.has(h)) byHash.set(h, p);
    }
  }
}
if (existsSync(cacheDir)) walk(cacheDir);
writeFileSync(hashCacheFile, JSON.stringify(hashCache));

// --- load packs, reviews, audits, summary -------------------------------------------------------------
const sourcesDir = join(root, "src", "data", "sources");
const reviewsDir = join(root, "src", "data", "reviews");
const summary = JSON.parse(readFileSync(join(reviewsDir, "summary.json"), "utf8"));
const heldPacks = new Map(summary.packs.map((p) => [p.pack, p]));
const tax = JSON.parse(readFileSync(join(root, "src", "data", "taxonomy.json"), "utf8"));
const chaptersFor = new Map();
for (const b of tax.boards) for (const c of b.classes) for (const [s, d] of Object.entries(c.details ?? {})) chaptersFor.set(`${b.slug}/${c.level}/${s}`, new Set((d.chapters ?? []).map((x) => x.slug)));

const keyOf = (pack, q) => `${pack}#${q.number}${(q.part ?? "").replace(/[^A-Za-z0-9]/g, "")}`;
const re = (s) => new RegExp(s, "i");
const MARKS_NOT_PRINTED = re("no marks? (are |is )?printed|marks 0|placeholder|0 placeholder|not printed");
const MARKS_SPLIT = re("split|inferred|estimate|divided|even(ly)? split|from the (group|section) total|worked out");
const MARKS_FRACTION = re("fraction|½|2\\.5|half-mark|rounded");
const GROUP_SPANS = re("span|several chapters|mixed|multiple chapters|mixes");
const PASSAGE = re("passage|extract|poem|comprehension");
const TABLE = re("\\btable\\b");
const GRAPH = re("graph|chart|histogram|plot");
const MAP = re("\\bmap\\b|outline map");
const UNDERLINE = re("underlin");

const rows = [];
for (const f of readdirSync(sourcesDir).filter((x) => x.endsWith(".json"))) {
  const pack = JSON.parse(readFileSync(join(sourcesDir, f), "utf8"));
  const key = pack.source.key;
  const reviewFile = join(reviewsDir, `${key}.json`);
  const review = existsSync(reviewFile) ? JSON.parse(readFileSync(reviewFile, "utf8")) : null;
  const byKey = new Map((review?.questions ?? []).map((r) => [r.key, r]));
  const auditFiles = readdirSync(reviewsDir).filter((x) => x === `audit-${key}.json` || (x.startsWith(`audit-${key}--`) && x.endsWith(".json")));
  const disputed = new Map();
  const audited = new Set();
  for (const af of auditFiles) for (const c of JSON.parse(readFileSync(join(reviewsDir, af), "utf8")).checks ?? []) (c.agree === false ? disputed.set(c.key, c.reason) : audited.add(c.key));
  const packInfo = heldPacks.get(key);
  const pdf = byHash.get(pack.source.sha256) ?? null;
  const valid = chaptersFor.get(`${pack.source.board}/${pack.source.class}/${pack.source.subject}`) ?? new Set();
  for (const q of pack.questions) {
    if (!q.chapter) continue; // not loaded at all
    const k = keyOf(key, q);
    const r = byKey.get(k);
    const d = decide(q, r, review?.source ?? {}, valid);
    let state = d.state;
    if (state === "AUTO_VERIFIED" && disputed.has(k)) state = "HOLD_AUDIT";
    if (state === "AUTO_VERIFIED" && packInfo?.audit?.heldPack) state = "HOLD_AUDIT";
    if (state === "AUTO_VERIFIED" && r && !auditFiles.length) state = "HOLD_AUDIT";
    if (state === "AUTO_VERIFIED" || state === "PENDING_REVIEW") continue;
    const why = [r?.reason ?? "", ...(q.extractionIssues ?? []), ...d.reasons].join(" | ");
    const cats = new Set();
    if (r?.figure === "ESSENTIAL_MISSING" || (q.hasFigure && q.confidence === "LOW")) {
      if (MAP.test(why)) cats.add("MAP");
      else if (GRAPH.test(why)) cats.add("GRAPH");
      else if (TABLE.test(why)) cats.add("TABLE");
      else cats.add("FIGURE");
    }
    if (r?.text === "INCOMPLETE" && PASSAGE.test(why)) cats.add("PASSAGE");
    if (UNDERLINE.test(why) && r?.text !== "MATCH") cats.add("UNDERLINE");
    if (["MISMATCH", "INCOMPLETE"].includes(r?.text) && !cats.has("PASSAGE") && !cats.has("UNDERLINE")) cats.add("OCR");
    if (r?.notation === "LOST" || /written flat/.test(d.reasons.join(" "))) cats.add("OCR");
    if (["MISMATCH", "MISSING"].includes(r?.options)) cats.add("OCR");
    if (r?.marks === "MISMATCH" || q.marks === 0) {
      if (MARKS_FRACTION.test(why)) cats.add("MARKS_FRACTION");
      else if (MARKS_NOT_PRINTED.test(why) || q.marks === 0) cats.add("MARKS_NOT_PRINTED");
      else if (MARKS_SPLIT.test(why)) cats.add("MARKS_SPLIT");
      else cats.add("MARKS_OTHER");
    }
    if (r?.numberPage === "MISMATCH") cats.add("NUMBER_PAGE");
    if (r?.chapter === "UNCERTAIN" || (r?.chapter === "WRONG" && !valid.has(r?.suggestedChapter))) cats.add(GROUP_SPANS.test(r?.reason ?? "") ? "CHAPTER_GROUP_SPANS" : "CHAPTER");
    if (r?.answer === "MISMATCH" || state === "HOLD_ANSWER") cats.add("ANSWER");
    if (state === "HOLD_AUDIT") cats.add(disputed.has(k) ? "AUDIT_DISPUTED" : packInfo?.audit?.heldPack ? "AUDIT_PACK_HELD" : "AUDIT_PENDING");
    if (q.confidence === "LOW" && cats.size === 0) cats.add("LOW_CONFIDENCE_OTHER");
    if (!r) cats.add("NOT_REVIEWED");
    if (!pdf) cats.add("NO_PDF");
    if (cats.size === 0) cats.add("OTHER");
    rows.push({
      key: k,
      pack: key,
      board: pack.source.board,
      class: pack.source.class,
      subject: pack.source.subject,
      paperType: pack.source.paperType,
      page: q.page,
      number: q.number,
      part: q.part ?? null,
      chapter: q.chapter,
      marks: q.marks,
      hasFigure: Boolean(q.hasFigure),
      state,
      categories: [...cats],
      reason: (r?.reason || d.reasons.join(" ")).slice(0, 400),
      disputeReason: disputed.get(k) ?? null,
      pdf: pdf ? pdf.slice(root.length + 1).replaceAll("\\", "/") : null,
    });
  }
}

writeFileSync(join(outDir, "held.json"), JSON.stringify(rows, null, 1));
const count = (f) => {
  const m = {};
  for (const r of rows) for (const c of f(r)) m[c] = (m[c] ?? 0) + 1;
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
console.log(`held: ${rows.length}; with local PDF: ${rows.filter((r) => r.pdf).length}`);
console.log("by state:", count((r) => [r.state]));
console.log("by category:", count((r) => r.categories));
console.log("by class:", count((r) => [`${r.board === "icse" && r.class >= 11 ? "isc" : r.board} ${r.class}`]));
const only = (cat) => rows.filter((r) => r.categories.length === 1 && r.categories[0] === cat).length;
console.log("single-cause holds:", Object.fromEntries(["FIGURE", "TABLE", "GRAPH", "MAP", "PASSAGE", "UNDERLINE", "OCR", "MARKS_SPLIT", "MARKS_NOT_PRINTED", "MARKS_FRACTION", "CHAPTER", "CHAPTER_GROUP_SPANS", "ANSWER", "AUDIT_DISPUTED", "AUDIT_PACK_HELD", "AUDIT_PENDING"].map((c) => [c, only(c)])));
