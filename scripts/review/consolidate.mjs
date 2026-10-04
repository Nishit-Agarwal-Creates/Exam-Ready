// Consolidates review evidence into final review decisions and writes drizzle/seed/review.sql.
//
//   node scripts/review/consolidate.mjs
//
// Inputs:  src/data/sources/<pack>.json          the extracted questions
//          src/data/reviews/<pack>.json          one independent reviewer's evidence per question
//          src/data/reviews/audit-<pack>.json    a second reviewer's re-check of a sample (optional)
// Outputs: drizzle/seed/review.sql               idempotent UPDATEs (only questions still UNVERIFIED)
//          src/data/reviews/summary.json         counts and reasons, shown in /admin/research
//
// The publication rule is applied here, deterministically, from the evidence; a reviewer's own PUBLISH
// is necessary but not sufficient. The stricter outcome always wins. Editor decisions (anything not
// UNVERIFIED) are never touched, and re-running produces the same SQL.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkReview } from "./check-review.mjs";
import { packQuestionKey } from "./keys.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sourcesDir = join(root, "src", "data", "sources");
const reviewsDir = join(root, "src", "data", "reviews");
const outSql = join(root, "drizzle", "seed", "review.sql");
const outSummary = join(reviewsDir, "summary.json");
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

/** Subjects where every question with numbers or symbols must pass the independent audit before publishing. */
const NUMERIC = new Set(["mathematics", "physics", "chemistry", "science"]);

/** Audits: if more than this share of sampled PUBLISH decisions are disputed, the whole pack is held for re-review. */
const AUDIT_MAX_DISAGREEMENT = 0.2;

/** Flattened powers of ten and unit exponents (not "× 100", not class intervals like "10-20"). */
export const FLAT_POWER = [/[x×]\s?10(?:\s?-\d|[1-9])/, /\d\s?(?:mm|cm|km|m)[23](?![\d.])/, /\b(?:mol|L|s|K|g|m|cm|kg|J|N)\s?-\s?[1-9](?![\d])/];

/** Final state for one reviewed question, from the evidence alone. */
export function decide(item, review, packSource, validChapters) {
  const reasons = [];
  let state = "AUTO_VERIFIED";
  const hold = (s, why) => {
    // Precedence: invalid > missing source > figure > answer > mapping > low confidence
    const order = ["REJECTED_INVALID", "REJECTED_DUPLICATE", "HOLD_MISSING_SOURCE", "HOLD_MISSING_FIGURE", "HOLD_ANSWER", "HOLD_MAPPING", "HOLD_LOW_CONFIDENCE", "HOLD_AUDIT", "AUTO_VERIFIED"];
    if (order.indexOf(s) < order.indexOf(state)) state = s;
    reasons.push(why);
  };
  if (!review) return { state: "PENDING_REVIEW", reasons: ["Not reviewed yet."], chapter: item.chapter };
  if (review.decision === "REJECT") hold(review.duplicate ? "REJECTED_DUPLICATE" : "REJECTED_INVALID", review.reason || "Rejected by the reviewer.");
  if (!packSource.sha256Match || !packSource.official || !packSource.metadataMatches) hold("HOLD_MISSING_SOURCE", packSource.notes || "The source document could not be confirmed.");
  if (review.figure === "ESSENTIAL_MISSING") hold("HOLD_MISSING_FIGURE", review.reason || "A figure needed to answer is not reproduced.");
  if (review.answer === "MISMATCH") hold("HOLD_ANSWER", review.reason || "The stored answer doesn't match the official scheme.");
  // An official answer must be the board's words; an extractor's own reconstruction is not.
  if (/reconstruct|unrecoverable|not directly legible/i.test(item.officialAnswer?.text ?? ""))
    hold("HOLD_ANSWER", "The stored official answer contains a reconstructed step, not only the board's own words.");
  let chapter = item.chapter;
  if (review.chapter === "UNCERTAIN") hold("HOLD_MAPPING", review.reason || "The chapter mapping is uncertain.");
  if (review.chapter === "WRONG") {
    if (review.suggestedChapter && validChapters.has(review.suggestedChapter)) chapter = review.suggestedChapter;
    else hold("HOLD_MAPPING", review.reason || "The stored chapter is wrong and no valid replacement was given.");
  }
  if (["MISMATCH", "INCOMPLETE"].includes(review.text)) hold("HOLD_LOW_CONFIDENCE", review.reason || "The text doesn't match the source.");
  if (review.numberPage === "MISMATCH" || review.marks === "MISMATCH") hold("HOLD_LOW_CONFIDENCE", review.reason || "Question number, page or marks don't match.");
  if (["MISMATCH", "MISSING"].includes(review.options)) hold("HOLD_LOW_CONFIDENCE", review.reason || "Options are missing or wrong.");
  if (review.notation === "LOST") hold("HOLD_LOW_CONFIDENCE", review.reason || "Mathematical or chemical notation was lost in extraction.");
  // Powers written flat read as different numbers: "5 x 10-7 m2" is 5 × 10⁻⁷ m², "108" may be 10⁸.
  const shown = [item.text, ...(item.options ?? []), item.officialAnswer?.text ?? ""].join(" ");
  if (FLAT_POWER.some((re) => re.test(shown)))
    hold("HOLD_LOW_CONFIDENCE", "A power or unit exponent is written flat (for example 10-3 for 10⁻³ or cm2 for cm²); the notation must be restored first.");
  if (item.confidence === "LOW") hold("HOLD_LOW_CONFIDENCE", "The extraction itself was rated low confidence.");
  if (state === "AUTO_VERIFIED" && review.decision !== "PUBLISH") hold("HOLD_LOW_CONFIDENCE", review.reason || "The reviewer held it.");
  return { state, reasons: [...new Set(reasons.filter(Boolean))], chapter };
}

function main() {
  const packs = readdirSync(sourcesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(sourcesDir, f), "utf8")));
  const tax = JSON.parse(readFileSync(join(root, "src", "data", "taxonomy.json"), "utf8"));
  const chaptersFor = new Map();
  for (const b of tax.boards)
    for (const c of b.classes) for (const [s, d] of Object.entries(c.details ?? {})) chaptersFor.set(`${b.slug}/${c.level}/${s}`, new Set((d.chapters ?? []).map((x) => x.slug)));
  for (const f of readdirSync(join(root, "src", "data", "demo")).filter((f) => f.endsWith(".json"))) {
    const d = JSON.parse(readFileSync(join(root, "src", "data", "demo", f), "utf8"));
    const k = `${d.board}/${d.class}/${d.subject?.slug ?? d.subject}`;
    const set = chaptersFor.get(k) ?? new Set();
    for (const ch of d.chapters ?? []) set.add(ch.slug);
    chaptersFor.set(k, set);
  }

  // Faithful to the source, but the source itself looks wrong: an editor decides (src/data/reviews/holds.json).
  const holdsFile = join(reviewsDir, "holds.json");
  const editorHolds = new Map(existsSync(holdsFile) ? JSON.parse(readFileSync(holdsFile, "utf8")).holds.map((h) => [h.key, h]) : []);
  // Minus signs drawn as shapes are invisible to every text extractor (scripts/review/minus-scan.py).
  const minusFile = join(reviewsDir, "minus-scan.json");
  const minusFlags = new Map(existsSync(minusFile) ? JSON.parse(readFileSync(minusFile, "utf8")).flags.map((m) => [m.key, m]) : []);
  // Reproduction rights per board (src/data/reviews/rights.json): only PERMITTED boards auto-publish.
  const rights = JSON.parse(readFileSync(join(reviewsDir, "rights.json"), "utf8")).boards;
  const now = new Date().toISOString().slice(0, 10);
  const sql = ["-- Generated by scripts/review/consolidate.mjs. Do not edit by hand. Only touches questions that are still UNVERIFIED."];
  const summary = { generatedOn: now, packs: [], totals: {}, reasons: {} };
  const bump = (o, k, n = 1) => (o[k] = (o[k] ?? 0) + n);

  for (const pack of packs) {
    const key = pack.source.key;
    const file = join(reviewsDir, `${key}.json`);
    if (!existsSync(file)) {
      summary.packs.push({ pack: key, reviewed: false });
      continue;
    }
    const errors = checkReview(file);
    if (errors.length) {
      console.log(`[review] ${key}: review file has ${errors.length} errors; skipped (${errors[0]})`);
      summary.packs.push({ pack: key, reviewed: false, errors: errors.length });
      continue;
    }
    const review = JSON.parse(readFileSync(file, "utf8"));
    const byKey = new Map(review.questions.map((r) => [r.key, r]));
    // Audit: a second reviewer re-checked a sample of this pack's PUBLISH decisions.
    // Several audit files may exist per pack (audit-<pack>.json, audit-<pack>--2.json, …). Per key, any
    // disagreement wins over any agreement: one sceptical second reviewer is enough to hold a question.
    const auditFiles = readdirSync(reviewsDir)
      .filter((f) => f === `audit-${key}.json` || (f.startsWith(`audit-${key}--`) && f.endsWith(".json")))
      .sort();
    const audit = auditFiles.length
      ? {
          checks: [
            ...new Map(
              auditFiles
                .flatMap((f) => JSON.parse(readFileSync(join(reviewsDir, f), "utf8")).checks ?? [])
                .sort((x, y) => Number(x.agree === false) - Number(y.agree === false))
                .map((c) => [c.key, c]),
            ).values(),
          ],
        }
      : null;
    const disputed = new Set((audit?.checks ?? []).filter((c) => c.agree === false).map((c) => c.key));
    const auditRate = audit?.checks?.length ? disputed.size / audit.checks.length : 0;
    const packHeldByAudit = Boolean(audit) && auditRate > AUDIT_MAX_DISAGREEMENT;
    const valid = chaptersFor.get(`${pack.source.board}/${pack.source.class}/${pack.source.subject}`) ?? new Set();
    const counts = {};
    for (const item of pack.questions) {
      if (!item.chapter) continue;
      const qkey = packQuestionKey(key, item);
      let { state, reasons, chapter } = decide(item, byKey.get(qkey), review.source, valid);
      // Rebuilt notation, corrected chapters and minor text differences need an independent audit before publishing.
      const r = byKey.get(qkey);
      const needsAudit = r && (r.notation === "REBUILT_OK" || r.text === "MINOR" || r.chapter === "WRONG" || (NUMERIC.has(pack.source.subject) && /[0-9√π∫θαβλμΩ±×÷²³⁻]/.test(`${item.text} ${(item.options ?? []).join(" ")}`)));
      const audited = (audit?.checks ?? []).some((c) => c.key === qkey && c.agree === true);
      if (state === "AUTO_VERIFIED" && needsAudit && !audited && !disputed.has(qkey)) {
        state = "HOLD_AUDIT";
        reasons = ["Waiting for the independent audit (numbers, notation, a corrected chapter or a minor text difference must be re-checked)."];
      }
      if (state === "AUTO_VERIFIED" && disputed.has(qkey)) {
        state = "HOLD_AUDIT";
        reasons = [(audit.checks.find((c) => c.key === qkey)?.reason || "A second reviewer disagreed with publishing this question.")];
      }
      const editorHold = editorHolds.get(qkey);
      if (editorHold && (state === "AUTO_VERIFIED" || state === "HOLD_AUDIT")) {
        state = editorHold.state;
        reasons = [editorHold.reason];
      }
      if (state === "AUTO_VERIFIED" && minusFlags.has(qkey)) {
        state = "HOLD_AUDIT";
        reasons = [`The page draws a minus sign as a shape just before "${minusFlags.get(qkey).token}", which text extraction drops; a reviewer must confirm every sign.`];
      }
      if (state === "AUTO_VERIFIED" && !audit) {
        state = "HOLD_AUDIT";
        reasons = ["Waiting for the independent audit of this source document."];
      }
      if (state === "AUTO_VERIFIED" && packHeldByAudit) {
        state = "HOLD_AUDIT";
        reasons = [`The audit disputed ${Math.round(auditRate * 100)}% of this source's sampled decisions, so it needs a fresh review.`];
      }
      if (state === "AUTO_VERIFIED" && !["PERMITTED", "OWNER_AUTHORISED"].includes(rights[pack.source.board]?.status)) {
        state = "HOLD_RIGHTS";
        reasons = [`Passed every check. ${pack.source.board === "icse" ? "CISCE" : pack.source.board.toUpperCase()}'s terms require written permission before its questions are reproduced; it stays linked, not shown, until permission is recorded.`];
      }
      bump(counts, state);
      bump(summary.totals, state);
      for (const r of reasons) if (state !== "AUTO_VERIFIED") bump(summary.reasons, `${state}: ${r.length > 90 ? r.slice(0, 87) + "…" : r}`);
      const reason = reasons.join(" ").slice(0, 500);
      const where = `WHERE external_key = ${q(qkey)} AND verification_status = 'UNVERIFIED'`;
      if (state === "AUTO_VERIFIED") {
        const remap =
          chapter !== item.chapter
            ? `, chapter_id = COALESCE((SELECT ch.id FROM chapters ch WHERE ch.slug = ${q(chapter)} AND ch.subject_id = questions.subject_id), chapter_id), topic_id = NULL`
            : "";
        sql.push(
          `UPDATE questions SET verification_status = 'VERIFIED', is_published = 1, verified_by = 'ExamReady automated review', verified_at = ${q(`${now}T00:00:00Z`)}, mapping_status = 'CONFIRMED', mapping_source = 'review', review_state = 'AUTO_VERIFIED', review_reason = ${q(
            chapter !== item.chapter ? `Chapter corrected by review (was ${item.chapter}).` : "",
          )}, reviewed_at = ${q(now)}, verification_notes = TRIM(verification_notes || ' Checked against the official document by ExamReady''s automated review on ${now}.')${remap}, updated_at = ${q(now)} ${where};`,
        );
      } else if (state.startsWith("REJECTED")) {
        sql.push(`UPDATE questions SET verification_status = 'REJECTED', is_published = 0, review_state = ${q(state)}, review_reason = ${q(reason)}, reviewed_at = ${q(now)}, updated_at = ${q(now)} ${where};`);
      } else {
        sql.push(`UPDATE questions SET is_published = 0, review_state = ${q(state)}, review_reason = ${q(reason)}, reviewed_at = ${q(now)}, updated_at = ${q(now)} ${where};`);
      }
    }
    summary.packs.push({ pack: key, reviewed: true, audit: audit ? { sampled: audit.checks.length, disputed: disputed.size, heldPack: packHeldByAudit } : null, counts });
  }
  // Keep cached frequency in step with what is now verified.
  sql.push(
    "UPDATE questions SET frequency_count = (SELECT COUNT(DISTINCT p.id) FROM question_sources qs JOIN papers p ON p.id = qs.paper_id WHERE qs.question_id = questions.id AND p.paper_type = 'BOARD_EXAM' AND p.is_demo = 0) WHERE is_demo = 0;",
  );
  mkdirSync(dirname(outSql), { recursive: true });
  // Cached site-wide counts (src/lib/data/shared-cache.ts) must not outlive this change.
  sql.push("DELETE FROM cache_entries;");
  writeFileSync(outSql, sql.join("\n") + "\n", "utf8");
  summary.reasons = Object.fromEntries(Object.entries(summary.reasons).sort((a, b) => b[1] - a[1]));
  writeFileSync(outSummary, JSON.stringify(summary, null, 2) + "\n", "utf8");
  console.log(`[review] ${summary.packs.filter((p) => p.reviewed).length} packs reviewed → ${outSql}`);
  console.log(`[review] ${JSON.stringify(summary.totals)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
