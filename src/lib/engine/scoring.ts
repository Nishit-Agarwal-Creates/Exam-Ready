/**
 * Scoring of a submitted attempt. Pure functions (no database), shared by the submit, self-review and results code
 * and unit tested in tests/scoring.test.ts.
 *
 *  - gradeSubmission: one row per paper question, auto marks capped at each question's marks, maximum = the sum of
 *    the paper's question marks (what the student was shown), self-marked score empty while written answers wait.
 *  - itemScore: how a stored answer counts on the results page. The method stored when the attempt was submitted
 *    decides (a key added to the question later never turns a waiting answer into an automatic 0).
 *  - summarise: final / provisional totals and the percentage, computed the same way everywhere.
 */
import type { QuestionType } from "@/db/schema";
import { canAutoGrade, evaluate, type AnswerKey } from "./grading.ts";

export type GradedItem = {
  position: number;
  marks: number;
  question: { id: number; type: QuestionType; options?: string[] | null; answer?: { key: AnswerKey } | null };
};

export type SubmittedAnswer = { questionId: number; response: string | null; markedForReview?: boolean };

export type AnswerRow = {
  questionId: number;
  position: number;
  response: string | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  evaluationMethod: "AUTO" | "NONE";
  markedForReview: boolean;
};

export function gradeSubmission(items: GradedItem[], answers: SubmittedAnswer[]) {
  const responses = new Map(answers.map((a) => [a.questionId, a]));
  let autoScore = 0;
  const rows: AnswerRow[] = items.map((item) => {
    const given = responses.get(item.question.id);
    const response = given?.response?.trim() ? given.response.trim() : null;
    const optionCount = item.question.options?.length ?? undefined;
    const result = evaluate(item.question.type, item.question.answer?.key ?? null, item.marks, response, optionCount);
    const awarded = result.marksAwarded === null ? null : Math.min(result.marksAwarded, item.marks);
    if (awarded) autoScore += awarded;
    return {
      questionId: item.question.id,
      position: item.position,
      response,
      isCorrect: result.isCorrect,
      marksAwarded: awarded,
      evaluationMethod: result.method,
      markedForReview: given?.markedForReview ?? false,
    };
  });
  const maxScore = items.reduce((s, i) => s + i.marks, 0);
  // Nothing to self-review when no written answer was given, so the attempt is fully marked.
  const pendingWritten = rows.some((r) => r.evaluationMethod === "NONE" && r.response !== null);
  return { rows, autoScore, maxScore, selfScore: pendingWritten ? null : 0 };
}

export type StoredAnswer = { response: string | null; evaluationMethod: string; marksAwarded: number | null } | null | undefined;

/**
 * `auto`: the answer was marked automatically. `scored`: marks to count, or null while a written answer waits for
 * the student's marks. Unanswered questions score 0 and never wait. Marks are kept within 0..max.
 */
export function itemScore(
  marks: number,
  a: StoredAnswer,
  question: { type: QuestionType; options?: string[] | null; answer?: { key: AnswerKey } | null },
): { auto: boolean; answered: boolean; scored: number | null } {
  const answered = Boolean(a?.response);
  const auto = a ? a.evaluationMethod === "AUTO" : canAutoGrade(question.type, question.answer?.key ?? null, question.options?.length);
  const raw = auto ? (a?.marksAwarded ?? 0) : a?.evaluationMethod === "SELF" ? (a.marksAwarded ?? 0) : answered ? null : 0;
  return { auto, answered, scored: raw === null ? null : Math.min(Math.max(raw, 0), marks) };
}

/** Totals: `final` only when nothing waits for marking; the percentage is of the marks already marked. */
export function summarise(items: { marks: number; scored: number | null }[]) {
  const max = items.reduce((s, i) => s + i.marks, 0);
  const marked = items.filter((i) => i.scored !== null);
  const scored = marked.reduce((s, i) => s + (i.scored ?? 0), 0);
  const evaluatedMax = marked.reduce((s, i) => s + i.marks, 0);
  const pending = items.length - marked.length;
  return { scored, evaluatedMax, max, pending, final: pending === 0, percent: evaluatedMax > 0 ? Math.round((scored / evaluatedMax) * 100) : null };
}
