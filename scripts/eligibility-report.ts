// Read-only report: which questions can go into a generated (marked) paper, and why the others can't.
// Uses the same rule as the app (src/lib/engine/eligibility.ts). It never writes to the database.
//
//   node --experimental-strip-types scripts/eligibility-report.ts            # local D1
//   node --experimental-strip-types scripts/eligibility-report.ts --remote   # production D1 (read-only query)
//   ... --out report.json                                                     # also write every ineligible key + reasons
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { paperEligibility } from "../src/lib/engine/eligibility.ts";
import type { AnswerKey } from "../src/lib/engine/grading.ts";

const root = join(import.meta.dirname, "..");
const remote = process.argv.includes("--remote");
const outIdx = process.argv.indexOf("--out");
const out = outIdx > 0 ? process.argv[outIdx + 1] : null;

const SQL =
  "SELECT id, external_key, question_type, marks, marks_status, options, answer_key, (COALESCE(answer_text, '') <> '') AS has_text, is_demo, " +
  "verification_status, is_published FROM questions";
const raw = execFileSync(process.execPath, [join(root, "node_modules", "wrangler", "bin", "wrangler.js"), "d1", "execute", "DB", remote ? "--remote" : "--local", "--json", "--command", SQL], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 512 * 1024 * 1024,
  env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
});
type Row = {
  id: number;
  external_key: string | null;
  question_type: string;
  marks: number | null;
  marks_status: string;
  options: string | null;
  answer_key: string | null;
  has_text: number;
  is_demo: number;
  verification_status: string;
  is_published: number;
};
const rows: Row[] = JSON.parse(raw)[0].results;
const parse = <T>(s: string | null): T | null => {
  try {
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
};

const live = rows.filter((r) => r.is_published === 1 && r.verification_status === "VERIFIED");
const byReason = new Map<string, number>();
const byMode = new Map<string, number>();
const ineligible: { id: number; key: string | null; reasons: string[] }[] = [];
for (const r of live) {
  const e = paperEligibility({
    type: r.question_type,
    marks: r.marks,
    marksStatus: r.marks_status,
    options: parse<string[]>(r.options),
    answerKey: parse<AnswerKey>(r.answer_key),
    hasModelAnswer: r.has_text === 1,
  });
  byMode.set(e.eligible ? e.mode : "NOT_USABLE", (byMode.get(e.eligible ? e.mode : "NOT_USABLE") ?? 0) + 1);
  for (const reason of e.reasons) byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  if (!e.eligible) ineligible.push({ id: r.id, key: r.external_key, reasons: e.reasons });
}
console.log(`${remote ? "Production" : "Local"} database: ${rows.length} questions, ${live.length} published and verified.`);
console.log("\nPublished, verified questions by how a test marks them:");
for (const [k, v] of [...byMode].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(12)} ${v}`);
console.log("\nWhy questions can't be used in tests (a question can have several reasons):");
for (const [k, v] of [...byReason].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);
if (out) {
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), remote, totals: Object.fromEntries(byMode), reasons: Object.fromEntries(byReason), ineligible }, null, 1));
  console.log(`\nWrote ${ineligible.length} ineligible questions to ${out}`);
}
