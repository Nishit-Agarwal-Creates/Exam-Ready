// Validates the official source packs in src/data/sources/*.json before they are loaded.
//
//   node scripts/check-sources.mjs            check every pack
//   node scripts/check-sources.mjs <file>...  check only these packs
//   node scripts/check-sources.mjs --chapters <board> <class> <subject>   list valid chapter slugs
//
// Structural checks only: it cannot tell whether text matches the PDF. That is the editor's job in
// /admin/review. Exits 1 when any pack has an error.
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "src", "data", "sources");

const AUTHORITIES = ["OFFICIAL_BOARD", "OFFICIAL_INSTITUTION", "REPOSITORY", "USER_UPLOAD", "OTHER"];
const PAPER_TYPES = ["BOARD_EXAM", "SPECIMEN", "SAMPLE", "QUESTION_BANK", "SCHOOL_EXAM", "OTHER"];
const TYPES = ["MCQ", "ASSERTION_REASON", "FILL_BLANK", "SHORT_ANSWER", "LONG_ANSWER", "CASE_BASED", "NUMERICAL"];
const CONFIDENCE = ["HIGH", "MEDIUM", "LOW"];
const METHODS = ["PDF_TEXT_LAYER", "OCR", "MANUAL"];

// Chapters that exist: the taxonomy plus the demo bank's ICSE chapters (loaded by the seed).
const chapters = new Map();
const addChapter = (board, level, subject, slug) => {
  const k = `${board}/${level}/${subject}`;
  if (!chapters.has(k)) chapters.set(k, new Set());
  chapters.get(k).add(slug);
};
const tax = JSON.parse(readFileSync(join(root, "src", "data", "taxonomy.json"), "utf8"));
const subjectsByClass = new Map();
for (const b of tax.boards)
  for (const c of b.classes) {
    subjectsByClass.set(`${b.slug}/${c.level}`, new Set(c.subjects));
    for (const [s, d] of Object.entries(c.details ?? {})) for (const ch of d.chapters ?? []) addChapter(b.slug, c.level, s, ch.slug);
  }
const demoDir = join(root, "src", "data", "demo");
for (const f of readdirSync(demoDir).filter((f) => f.endsWith(".json"))) {
  const d = JSON.parse(readFileSync(join(demoDir, f), "utf8"));
  for (const ch of d.chapters ?? []) addChapter(d.board, d.class, d.subject?.slug ?? d.subject, ch.slug);
}

if (process.argv[2] === "--chapters") {
  const [board, level, subject] = process.argv.slice(3);
  const set = chapters.get(`${board}/${level}/${subject}`);
  if (!set) {
    console.log(`No chapters for ${board}/${level}/${subject}. Add them to src/data/taxonomy.json first.`);
    process.exit(1);
  }
  console.log([...set].join("\n"));
  process.exit(0);
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2).map((f) => (f.includes("/") || f.includes("\\") ? f : join(dir, f)))
  : readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(dir, f));

let failed = 0;
const keys = new Map();
for (const file of files) {
  const errors = [];
  const warnings = [];
  let pack;
  try {
    pack = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.log(`✗ ${basename(file)}: not valid JSON (${e.message})`);
    failed++;
    continue;
  }
  const s = pack.source ?? {};
  const need = (cond, msg) => cond || errors.push(msg);
  need(typeof s.key === "string" && /^[a-z0-9-]+$/.test(s.key), "source.key must be lowercase letters, digits and dashes");
  need(basename(file) === `${s.key}.json`, `file name must be ${s.key}.json`);
  if (keys.has(s.key)) errors.push(`source.key duplicates ${keys.get(s.key)}`);
  keys.set(s.key, basename(file));
  need(typeof s.title === "string" && s.title.length > 10, "source.title missing");
  need(["icse", "cbse"].includes(s.board), "source.board must be icse or cbse");
  need(Number.isInteger(s.class) && s.class >= 6 && s.class <= 12, "source.class must be 6–12");
  need(subjectsByClass.get(`${s.board}/${s.class}`)?.has(s.subject), `subject "${s.subject}" is not in taxonomy.json for ${s.board} class ${s.class}`);
  need(AUTHORITIES.includes(s.authority), "source.authority invalid");
  need(PAPER_TYPES.includes(s.paperType), "source.paperType invalid");
  need(s.examYear === null || (Number.isInteger(s.examYear) && s.examYear >= 1990 && s.examYear <= 2030), "source.examYear must be a year or null");
  if (s.paperType === "BOARD_EXAM") need(Number.isInteger(s.examYear), "a BOARD_EXAM pack needs the exam year printed on or published with the paper");
  need(typeof s.sourceUrl === "string" && /^https:\/\//.test(s.sourceUrl), "source.sourceUrl must be an https URL");
  need(METHODS.includes(s.extractionMethod), "source.extractionMethod invalid");
  need(typeof s.sha256 === "string" && /^[0-9a-f]{64}$/.test(s.sha256), "source.sha256 must be the SHA-256 of the PDF");
  need(Number.isInteger(s.pageCount) && s.pageCount > 0, "source.pageCount missing");
  if (!s.accessedOn) warnings.push("source.accessedOn (YYYY-MM-DD) not set");

  const qs = Array.isArray(pack.questions) ? pack.questions : [];
  need(qs.length > 0, "no questions");
  const chapterSet = chapters.get(`${s.board}/${s.class}/${s.subject}`) ?? new Set();
  const seen = new Set();
  let marks = 0;
  const groups = new Map();
  for (const [i, q] of qs.entries()) {
    const id = `Q${q.number ?? "?"}${q.part ?? ""} (#${i + 1})`;
    const qneed = (cond, msg) => cond || errors.push(`${id}: ${msg}`);
    qneed(typeof q.number === "string" && q.number.length > 0, "number must be a non-empty string as printed");
    const k = `${q.number}${q.part ? q.part.replace(/[^a-z0-9ivx]/gi, "") : ""}`;
    qneed(!seen.has(k), `duplicate number/part "${k}" (external keys would collide)`);
    seen.add(k);
    qneed(Number.isInteger(q.page) && q.page >= 1 && q.page <= (s.pageCount ?? 999), "page must be a 1-based page inside the PDF");
    qneed(Number.isInteger(q.marks) && q.marks >= 0 && q.marks <= 20, "marks must be an integer 0–20");
    qneed(["PRINTED", "SECTION_INSTRUCTIONS"].includes(q.marksSource), "marksSource must be PRINTED or SECTION_INSTRUCTIONS");
    qneed(TYPES.includes(q.type), `type must be one of ${TYPES.join(", ")}`);
    qneed(typeof q.text === "string" && q.text.trim().length >= 8, "text missing");
    if (typeof q.text === "string" && /\b(Page \d+ of \d+|P\.T\.O\.?)\b/.test(q.text)) warnings.push(`${id}: text contains a page header/footer`);
    const needsOptions = q.type === "MCQ" || q.type === "ASSERTION_REASON";
    if (needsOptions && !(Array.isArray(q.options) && q.options.length >= 2))
      warnings.push(`${id}: ${q.type} without extractable options (will be flagged)`);
    if (q.options != null) {
      qneed(Array.isArray(q.options) && q.options.every((o) => typeof o === "string" && o.trim()), "options must be non-empty strings");
      // "(A) is true and (R) is false" is assertion-reason wording, not an option label.
      if (Array.isArray(q.options) && q.options.some((o) => /^\(?[a-dA-D]\)\s/.test(o) && !/^\(A\) (is|and|as)\b|^Both \(A\)/.test(o)))
        warnings.push(`${id}: options still carry (a)/(A) labels`);
    }
    if (q.officialAnswer) {
      const a = q.officialAnswer;
      qneed(typeof a.text === "string", "officialAnswer.text must be a string");
      if (a.correctOption != null) {
        qneed(needsOptions, "correctOption is only for MCQ / assertion-reason");
        qneed(Number.isInteger(a.correctOption) && Array.isArray(q.options) && a.correctOption >= 0 && a.correctOption < q.options.length, "correctOption must be a 0-based index into options");
      }
      if (!s.answerSourceUrl) errors.push(`${id}: has an officialAnswer but source.answerSourceUrl is not set`);
    }
    qneed(typeof q.hasFigure === "boolean", "hasFigure must be true/false");
    qneed(Array.isArray(q.extractionIssues), "extractionIssues must be an array");
    if (q.hasFigure && !(q.extractionIssues ?? []).some((x) => /figure|diagram|graph|table|map|image/i.test(x)))
      warnings.push(`${id}: hasFigure but no issue says what is missing`);
    qneed(CONFIDENCE.includes(q.confidence), "confidence must be HIGH, MEDIUM or LOW");
    if (q.chapter === null) warnings.push(`${id}: no chapter fits; the loader skips it until an editor maps it`);
    else qneed(typeof q.chapter === "string" && chapterSet.has(q.chapter), `chapter "${q.chapter}" does not exist for ${s.board}/${s.class}/${s.subject}`);
    qneed(q.mappingStatus === "AI_SUGGESTED", 'mappingStatus must be "AI_SUGGESTED" (only editors confirm)');
    if (q.choiceGroup) {
      groups.set(q.choiceGroup, (groups.get(q.choiceGroup) ?? 0) + 1);
    } else if (Number.isInteger(q.marks)) marks += q.marks;
  }
  for (const [g, n] of groups) if (n < 2) warnings.push(`choiceGroup ${g} has only one alternative`);
  // One alternative per choice group counts towards the total.
  const groupMarks = new Map();
  for (const q of qs) if (q.choiceGroup) groupMarks.set(q.choiceGroup, Math.max(groupMarks.get(q.choiceGroup) ?? 0, q.marks ?? 0));
  const total = marks + [...groupMarks.values()].reduce((a, b) => a + b, 0);
  if (s.maxMarks && total !== s.maxMarks) warnings.push(`marks add up to ${total}, paper maximum is ${s.maxMarks} (fine if sub-parts or choices are counted differently; check)`);

  const status = errors.length ? "✗" : "✓";
  if (errors.length) failed++;
  console.log(`${status} ${basename(file)}: ${qs.length} questions, ${errors.length} errors, ${warnings.length} warnings`);
  for (const e of errors.slice(0, 40)) console.log(`   error: ${e}`);
  if (errors.length > 40) console.log(`   … ${errors.length - 40} more errors`);
  for (const w of warnings.slice(0, 25)) console.log(`   warning: ${w}`);
  if (warnings.length > 25) console.log(`   … ${warnings.length - 25} more warnings`);
}
process.exit(failed ? 1 : 0);
