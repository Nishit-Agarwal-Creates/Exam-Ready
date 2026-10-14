/**
 * Practice worksheets. Pure functions (no database), unit tested in tests/worksheet.test.ts.
 *
 * A worksheet is a number of questions to practise, not a scored test:
 *  - It may include questions without an answer key or a mark of their own (school papers often print neither).
 *    Nothing is invented for them: no answer, no mark, no total.
 *  - Questions with a valid key are checked after submission; everything else is "not graded" and is shown with
 *    its model answer when one is published, or "Model answer not available yet".
 *  - Board, class and subject never mix (the pool is one subject); chapter, type and figure filters still apply.
 *  - At most one question per duplicate group, spread across chapters, questions with an answer first.
 */
import { compositionOf, modeCategories, mulberry32, sourceCategory, type Composition, type PoolQuestion, type Stage } from "./generator.ts";

export const WORKSHEET_MIN = 5;
export const WORKSHEET_MAX = 60;

const TYPES = new Set(["MCQ", "ASSERTION_REASON", "FILL_BLANK", "NUMERICAL", "SHORT_ANSWER", "LONG_ANSWER", "CASE_BASED"]);
const OPTION_TYPES = new Set(["MCQ", "ASSERTION_REASON"]);

/** Why a question can't be practised (empty when it can). Marks and answers are NOT required for practice. */
export function practiceReasons(q: { type: string; text?: string | null; options?: string[] | null }): string[] {
  const reasons: string[] = [];
  if (!TYPES.has(q.type)) reasons.push(`Unknown question type "${q.type}".`);
  if (q.text !== undefined && !(q.text ?? "").trim()) reasons.push("Its question text is missing.");
  if (OPTION_TYPES.has(q.type) && (q.options?.filter((o) => o.trim() !== "").length ?? 0) < 2) reasons.push("It is a choice question but its options aren't available as text.");
  return reasons;
}

export type MarksLabel = { kind: "PRINTED" | "GROUP_TOTAL" | "FRACTIONAL" | "PRACTICE" | "UNAVAILABLE"; short: string; long: string };

/**
 * How a question's marks are shown. Printed marks are shown as printed; a group total or a printed fraction is
 * quoted; an editor's practice suggestion is labelled as a suggestion; otherwise marks are "not printed".
 */
export function marksLabel(q: { marks: number; marksStatus?: string | null; marksNote?: string | null; practiceMarks?: number | null }): MarksLabel {
  const status = q.marksStatus ?? "PRINTED";
  if (status === "PRINTED" && Number.isInteger(q.marks) && q.marks > 0)
    return { kind: "PRINTED", short: `[${q.marks}]`, long: `${q.marks} mark${q.marks === 1 ? "" : "s"}, as printed on the paper` };
  if (status === "GROUP_TOTAL")
    return { kind: "GROUP_TOTAL", short: "[–]", long: q.marksNote ? `Group total printed on the paper: ${q.marksNote}` : "Only a total for its group is printed" };
  if (status === "FRACTIONAL") return { kind: "FRACTIONAL", short: `[${q.marksNote || "–"}]`, long: `Printed mark: ${q.marksNote || "a fraction"}` };
  if (q.practiceMarks && q.practiceMarks > 0)
    return {
      kind: "PRACTICE",
      short: `(${q.practiceMarks}*)`,
      long: `Suggested practice marks: ${q.practiceMarks} (an ExamReady suggestion, not printed on the paper)`,
    };
  return { kind: "UNAVAILABLE", short: "[–]", long: "Marks not printed on the paper" };
}

export type WorksheetRequest = { count: number; seed: number; allowSupplement?: boolean };

export type WorksheetSuccess = {
  ok: true;
  /** marks = the printed mark (0 when the paper prints none for the item). */
  selected: { questionId: number; marks: number; section: string }[];
  composition: Composition;
  /** Printed marks of the questions that have them, and how many questions that is. */
  printedMarks: number;
  printedCount: number;
  withAnswer: number;
  notices: string[];
  stages: Stage[];
};
export type WorksheetFailure = { ok: false; reason: "NO_QUESTIONS"; message: string; available: number; stages: Stage[] };
export type WorksheetResult = WorksheetSuccess | WorksheetFailure;

/** Questions a worksheet may draw from: the PRACTICE mode's categories (AI practice only when allowed) and practicable. */
export function worksheetPool(pool: PoolQuestion[], allowSupplement = false): PoolQuestion[] {
  const cats = modeCategories("PRACTICE", true).filter((c) => c !== "AI" || allowSupplement);
  return pool.filter((q) => {
    const c = sourceCategory(q);
    return c !== null && cats.includes(c) && q.practicable !== false;
  });
}

const TYPE_ORDER = ["MCQ", "ASSERTION_REASON", "FILL_BLANK", "NUMERICAL", "SHORT_ANSWER", "CASE_BASED", "LONG_ANSWER"];

export function generateWorksheet(pool: PoolQuestion[], req: WorksheetRequest): WorksheetResult {
  const rng = mulberry32(req.seed);
  const count = Math.max(WORKSHEET_MIN, Math.min(WORKSHEET_MAX, Math.round(req.count)));
  const stages: Stage[] = [];
  const inScope = pool.filter((q) => q.isPublished && q.verificationStatus !== "REJECTED");
  stages.push({ key: "search", label: "Searched the question bank", detail: `${inScope.length} published questions in scope` });
  const eligible = worksheetPool(pool, req.allowSupplement);
  const left = inScope.length - eligible.length;
  stages.push({
    key: "practicable",
    label: "Checked the questions can be practised",
    detail: `${eligible.length} can be practised${left ? `; ${left} left out (options missing, not reviewed, or AI practice not chosen)` : ""}`,
  });
  // One per duplicate group: prefer the one with an answer, then the most recent exam year.
  const best = new Map<number, PoolQuestion>();
  for (const q of eligible) {
    const cur = best.get(q.groupId);
    if (!cur || (Boolean(q.hasAnswer) && !cur.hasAnswer) || (Boolean(q.hasAnswer) === Boolean(cur.hasAnswer) && (q.year ?? 0) > (cur.year ?? 0))) best.set(q.groupId, q);
  }
  const unique = [...best.values()];
  if (eligible.length !== unique.length) stages.push({ key: "duplicates", label: "Removed duplicates", detail: `${eligible.length - unique.length} repeats across sets skipped` });
  if (unique.length === 0) {
    return {
      ok: false,
      reason: "NO_QUESTIONS",
      message: left
        ? `None of the ${left} question${left === 1 ? "" : "s"} in this selection can be practised yet (options missing, not reviewed, or AI practice not chosen). Nothing will be made up to fill the gap.`
        : "There are no reviewed questions for this selection yet. Nothing will be made up to fill the gap.",
      available: 0,
      stages,
    };
  }
  // Questions with an answer first, then round-robin across chapters so no chapter dominates.
  const jitter = new Map(unique.map((q) => [q.id, rng()]));
  const ordered: PoolQuestion[] = [];
  for (const withAnswer of [true, false]) {
    const tier = unique.filter((q) => Boolean(q.hasAnswer) === withAnswer);
    const byChapter = new Map<number, PoolQuestion[]>();
    for (const q of tier) byChapter.set(q.chapterId, [...(byChapter.get(q.chapterId) ?? []), q]);
    const buckets = [...byChapter.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l.sort((a, b) => jitter.get(a.id)! - jitter.get(b.id)!));
    let added = true;
    while (added) {
      added = false;
      for (const b of buckets) {
        const next = b.shift();
        if (next) {
          ordered.push(next);
          added = true;
        }
      }
    }
  }
  const picked = ordered.slice(0, count);
  const notices: string[] = [];
  if (picked.length < count) notices.push(`Only ${picked.length} question${picked.length === 1 ? "" : "s"} can be practised for this selection, so the worksheet has ${picked.length} instead of ${count}.`);
  const sorted = [...picked].sort((a, b) => TYPE_ORDER.indexOf(a.questionType) - TYPE_ORDER.indexOf(b.questionType) || a.chapterId - b.chapterId || a.id - b.id);
  const printed = (q: PoolQuestion) => ((q.marksStatus ?? "PRINTED") === "PRINTED" && Number.isInteger(q.marks) && q.marks > 0 ? q.marks : 0);
  const selected = sorted.map((q) => ({ questionId: q.id, marks: printed(q), section: "" }));
  const printedCount = selected.filter((s) => s.marks > 0).length;
  const withAnswer = picked.filter((q) => q.hasAnswer).length;
  if (withAnswer < picked.length)
    notices.push(`${picked.length - withAnswer} of these questions have no published answer yet; after submitting you'll see "Model answer not available yet" for them.`);
  stages.push({ key: "build", label: "Built the worksheet", detail: `${picked.length} questions from ${new Set(picked.map((q) => q.chapterId)).size} chapters` });
  return {
    ok: true,
    selected,
    composition: compositionOf(sorted.map((q) => ({ ...q, marks: printed(q) }))),
    printedMarks: selected.reduce((s, x) => s + x.marks, 0),
    printedCount,
    withAnswer,
    notices,
    stages,
  };
}
