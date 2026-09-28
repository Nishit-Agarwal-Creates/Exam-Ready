// Validates review evidence files (src/data/reviews/<pack-key>.json) against their source packs.
//
//   node scripts/review/check-review.mjs            check every review file
//   node scripts/review/check-review.mjs <file>...  check only these
//
// Checks structure and completeness only: every loaded question in the pack must be reviewed exactly once,
// with allowed values. Exits 1 on any error.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packQuestionKey } from "./keys.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const reviewsDir = join(root, "src", "data", "reviews");
const sourcesDir = join(root, "src", "data", "sources");

export const ALLOWED = {
  text: ["MATCH", "MINOR", "MISMATCH", "INCOMPLETE"],
  numberPage: ["MATCH", "MISMATCH"],
  marks: ["MATCH", "MISMATCH"],
  options: ["MATCH", "MISMATCH", "MISSING", "NA"],
  notation: ["OK", "REBUILT_OK", "LOST"],
  figure: ["NONE", "NOT_ESSENTIAL", "ESSENTIAL_MISSING"],
  answer: ["MATCH", "PARTIAL", "MISMATCH", "NONE"],
  chapter: ["OK", "WRONG", "UNCERTAIN"],
  decision: ["PUBLISH", "HOLD", "REJECT"],
};

export function checkReview(file) {
  const errors = [];
  let r;
  try {
    r = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return [`not valid JSON (${e.message})`];
  }
  const packFile = join(sourcesDir, `${r.pack}.json`);
  if (!r.pack || !existsSync(packFile)) return [`pack "${r.pack}" not found in src/data/sources`];
  if (basename(file) !== `${r.pack}.json`) errors.push(`file name must be ${r.pack}.json`);
  const pack = JSON.parse(readFileSync(packFile, "utf8"));
  const s = r.source ?? {};
  for (const k of ["sha256Match", "official", "metadataMatches"]) if (typeof s[k] !== "boolean") errors.push(`source.${k} must be true/false`);
  const expected = new Set(pack.questions.filter((q) => q.chapter).map((q) => packQuestionKey(pack.source.key, q)));
  const seen = new Set();
  for (const [i, q] of (r.questions ?? []).entries()) {
    const id = q.key ?? `#${i + 1}`;
    if (!expected.has(q.key)) errors.push(`${id}: not a loaded question of this pack`);
    if (seen.has(q.key)) errors.push(`${id}: reviewed twice`);
    seen.add(q.key);
    for (const [field, values] of Object.entries(ALLOWED)) if (!values.includes(q[field])) errors.push(`${id}: ${field} must be one of ${values.join("|")}`);
    if (q.decision !== "PUBLISH" && !(q.reason ?? "").trim()) errors.push(`${id}: a ${q.decision} needs a reason`);
    if (q.chapter === "WRONG" && q.decision === "PUBLISH" && !q.suggestedChapter) errors.push(`${id}: WRONG chapter needs suggestedChapter to publish`);
  }
  for (const k of expected) if (!seen.has(k)) errors.push(`${k}: missing from the review`);
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : existsSync(reviewsDir)
      ? readdirSync(reviewsDir)
          .filter((f) => f.endsWith(".json") && !f.startsWith("audit-") && f !== "summary.json" && f !== "holds.json" && f !== "minus-scan.json" && f !== "rights.json")
          .map((f) => join(reviewsDir, f))
      : [];
  let failed = 0;
  for (const f of files) {
    const errs = checkReview(f);
    const r = (() => {
      try {
        return JSON.parse(readFileSync(f, "utf8"));
      } catch {
        return { questions: [] };
      }
    })();
    const count = (d) => (r.questions ?? []).filter((q) => q.decision === d).length;
    console.log(`${errs.length ? "✗" : "✓"} ${basename(f)}: ${(r.questions ?? []).length} reviewed (publish ${count("PUBLISH")}, hold ${count("HOLD")}, reject ${count("REJECT")}), ${errs.length} errors`);
    for (const e of errs.slice(0, 30)) console.log(`   error: ${e}`);
    if (errs.length) failed++;
  }
  process.exit(failed ? 1 : 0);
}
