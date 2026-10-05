// Picks the questions a second, independent reviewer must re-check for each reviewed pack:
//   - every PUBLISH decision whose notation was rebuilt (REBUILT_OK) or whose text was MINOR, and
//   - a deterministic sample of 6 other PUBLISH decisions (same pack → same sample every run).
//
//   node scripts/review/audit-sample.mjs [pack-key ...]
//   node scripts/review/audit-sample.mjs --missing [pack-key ...]   only keys no audit file covers yet, written as
//                                                                   samples/<pack>--N.json for a follow-up audit-<pack>--N.json
//
// Writes .sources-cache/review/samples/<pack>.json (not committed; regenerable).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const reviewsDir = join(root, "src", "data", "reviews");
const outDir = join(root, ".sources-cache", "review", "samples");
mkdirSync(outDir, { recursive: true });

const RANDOM_PER_PACK = 6;
const rank = (s) => createHash("sha1").update(s).digest("hex");

const missing = process.argv.includes("--missing");
const only = process.argv.slice(2).filter((a) => a !== "--missing");
const files = readdirSync(reviewsDir).filter((f) => f.endsWith(".json") && !f.startsWith("audit-") && f !== "summary.json" && f !== "holds.json" && f !== "minus-scan.json" && f !== "rights.json");
for (const f of files) {
  const r = JSON.parse(readFileSync(join(reviewsDir, f), "utf8"));
  if (only.length && !only.includes(r.pack)) continue;
  const publish = r.questions.filter((q) => q.decision === "PUBLISH");
  // In number-heavy subjects every question with a number or maths symbol is re-checked: -layout text
  // can silently squash fractions and drop signs even when the first reviewer saw nothing wrong.
  const pack = JSON.parse(readFileSync(join(root, "src", "data", "sources", `${r.pack}.json`), "utf8"));
  const numeric = ["mathematics", "physics", "chemistry", "science"].includes(pack.source.subject);
  const textOf = new Map(pack.questions.map((q) => [`${pack.source.key}#${q.number}${q.part ? q.part.replace(/[^a-z0-9ivx]/gi, "") : ""}`, `${q.text} ${(q.options ?? []).join(" ")}`]));
  const hasNumbers = (key) => /[0-9√π∫θαβλμΩ±×÷²³⁻]/.test(textOf.get(key) ?? "");
  const must = publish.filter((q) => q.figure === "RECOVERED" || q.recovery || q.notation === "REBUILT_OK" || q.text === "MINOR" || q.chapter === "WRONG" || (numeric && hasNumbers(q.key)));
  const rest = publish.filter((q) => !must.includes(q)).sort((a, b) => rank(a.key).localeCompare(rank(b.key)));
  const why = (q) => (q.figure === "RECOVERED" ? "recovered figure" : q.recovery ? "recovered by the pipeline" : q.notation === "REBUILT_OK" ? "rebuilt notation" : q.chapter === "WRONG" ? "chapter corrected" : q.text === "MINOR" ? "minor text difference" : "numbers or symbols");
  let sample = [...must, ...rest.slice(0, RANDOM_PER_PACK)].map((q) => ({ key: q.key, why: must.includes(q) ? why(q) : "random sample" }));
  let out = join(outDir, `${r.pack}.json`);
  if (missing) {
    const auditFiles = readdirSync(reviewsDir).filter((f) => f === `audit-${r.pack}.json` || (f.startsWith(`audit-${r.pack}--`) && f.endsWith(".json")));
    if (!auditFiles.length) {
      // Never audited: a full first sample.
      if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify({ pack: r.pack, sample }, null, 2) + "\n");
      console.log(`${r.pack}: ${sample.length} to audit (first audit) of ${publish.length} publish`);
      continue;
    }
    // A recovered question counts as audited only by a re-audit made after the recovery (checks marked round "p51").
    const checks = auditFiles.flatMap((f) => JSON.parse(readFileSync(join(reviewsDir, f), "utf8")).checks ?? []);
    // A question changed again by the audit fix round (recovery.agent "p51-fix-*") needs a check of round "p51-fix".
    const round = new Map(r.questions.filter((q) => q.recovery).map((q) => [q.key, /^p51-fix-H/.test(q.recovery.agent ?? "") ? ["p51-final"] : /^p51-fix/.test(q.recovery.agent ?? "") ? ["p51-fix", "p51-final"] : ["p51", "p51-fix", "p51-final"]]));
    const done = new Set(checks.filter((c) => !round.has(c.key) || round.get(c.key).includes(c.round)).map((c) => c.key));
    sample = sample.filter((s) => s.why !== "random sample" && !done.has(s.key));
    if (!sample.length) continue;
    out = join(outDir, `${r.pack}--${auditFiles.length + 1}.json`);
  }
  if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ pack: r.pack, sample }, null, 2) + "\n");
  console.log(`${r.pack}: ${sample.length} to audit${missing ? ` in ${basename(out)} (follow-up)` : ` (${must.length} required, ${sample.length - must.length} random)`} of ${publish.length} publish`);
}
