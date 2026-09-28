// Merges partial reviews of one large pack (written by several reviewers) into src/data/reviews/<pack>.json.
//   node scripts/review/merge-parts.mjs <pack-key> <part.json> [<part.json> ...]
// The source verdict is kept only if every part agrees; each question must appear exactly once across the parts.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkReview } from "./check-review.mjs";

const [pack, ...parts] = process.argv.slice(2);
if (!pack || !parts.length) throw new Error("usage: merge-parts.mjs <pack-key> <part.json>...");
const reviews = parts.map((p) => JSON.parse(readFileSync(p, "utf8")));
for (const r of reviews) if (r.pack !== pack) throw new Error(`${r.pack} is not ${pack}`);
const all = (k) => reviews.every((r) => r.source?.[k] === true);
const merged = {
  pack,
  reviewedOn: reviews.map((r) => r.reviewedOn).sort().at(-1),
  method: `Reviewed in ${reviews.length} parts by independent reviewers. ${reviews[0].method ?? ""}`.trim(),
  source: { sha256Match: all("sha256Match"), official: all("official"), metadataMatches: all("metadataMatches"), notes: reviews.map((r) => r.source?.notes).filter(Boolean).join(" | ") },
  questions: reviews.flatMap((r) => r.questions),
};
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "data", "reviews", `${pack}.json`);
writeFileSync(out, JSON.stringify(merged, null, 2) + "\n");
const errors = checkReview(out);
console.log(`${pack}: ${merged.questions.length} questions from ${reviews.length} parts, ${errors.length} errors`);
for (const e of errors.slice(0, 20)) console.log("  " + e);
process.exit(errors.length ? 1 : 0);
