// Builds drizzle/seed/answer-drafts.sql from src/data/answer-drafts/*.json (AI-written answer DRAFTS).
//
//   node --experimental-strip-types scripts/answer-drafts.ts           # validate + write SQL, print a report
//   node --experimental-strip-types scripts/answer-drafts.ts --check   # validate only
//
// Each draft is validated against its question's type and options in the source pack (src/data/sources), then stored as
// questions.answer_draft with origin "AI". Drafts are never shown to students and never used for marking; an editor reviews
// and publishes them in /admin/answers. The SQL is idempotent and conservative: it only fills an EMPTY draft slot of a
// question that has NO published answer, so it never overwrites an answer, an editor's draft or an earlier AI draft.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateDraft } from "../src/lib/engine/answers.ts";

const root = join(import.meta.dirname, "..");
const dir = join(root, "src", "data", "answer-drafts");
const out = join(root, "drizzle", "seed", "answer-drafts.sql");
const checkOnly = process.argv.includes("--check");
const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

type Entry = {
  key: string;
  status: "DRAFT" | "SKIP";
  key_answer: { correctOption: number } | { accepted: string[] } | { value: number; tolerance: number; unit?: string } | null;
  text: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  flags?: string[];
};

// Question type and options by external key, from the packs (the source of truth for question content).
const questions = new Map<string, { type: string; options: string[] | null }>();
for (const f of readdirSync(join(root, "src", "data", "sources"))) {
  if (!f.endsWith(".json")) continue;
  const pack = JSON.parse(readFileSync(join(root, "src", "data", "sources", f), "utf8"));
  for (const item of pack.questions) {
    const key = `${pack.source.key}#${item.number}${item.part ? String(item.part).replace(/[^a-z0-9ivx]/gi, "") : ""}`;
    questions.set(key, { type: item.type, options: Array.isArray(item.options) && item.options.length >= 2 ? item.options : null });
  }
}

const sql: string[] = [];
const report = { files: 0, entries: 0, drafted: 0, skipped: 0, invalid: 0, unknownKey: 0, byConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>, flagged: 0 };
const problems: string[] = [];
const files = (() => {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
})();
const at = new Date().toISOString();
for (const f of files) {
  report.files++;
  const entries: Entry[] = JSON.parse(readFileSync(join(dir, f), "utf8"));
  for (const e of entries) {
    report.entries++;
    const meta = questions.get(e.key);
    if (!meta) {
      report.unknownKey++;
      problems.push(`${f}: ${e.key}: no such question in the packs`);
      continue;
    }
    if (e.status === "SKIP") {
      report.skipped++;
      continue;
    }
    const draft = {
      origin: "AI" as const,
      text: (e.text ?? "").trim(),
      key: e.key_answer ?? null,
      confidence: e.confidence,
      flags: e.flags ?? [],
      notes: `AI-generated draft (${f.replace(/\.json$/, "")}), not reviewed. Check it against the question and any figure before publishing.`,
      savedBy: "ExamReady AI drafting",
      savedAt: at,
    };
    const errors = validateDraft(meta.type, meta.options, draft);
    // A numerical tolerance above 0 needs a reason; AI drafts carry it in flags.
    if (errors.notes && draft.flags.length) delete errors.notes;
    if (Object.keys(errors).length) {
      report.invalid++;
      problems.push(`${f}: ${e.key}: ${Object.values(errors).join(" ")}`);
      continue;
    }
    report.drafted++;
    report.byConfidence[e.confidence] = (report.byConfidence[e.confidence] ?? 0) + 1;
    if (draft.flags.length) report.flagged++;
    sql.push(
      `UPDATE questions SET answer_draft = ${q(JSON.stringify(draft))} WHERE external_key = ${q(e.key)} AND answer_draft IS NULL AND answer_source = 'NONE' AND COALESCE(answer_text, '') = '';`,
    );
  }
}
console.log(JSON.stringify(report, null, 1));
if (problems.length) console.log(problems.slice(0, 40).join("\n"));
if (!checkOnly) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, sql.join("\n") + "\n");
  console.log(`Wrote ${sql.length} statements to ${out}`);
}
