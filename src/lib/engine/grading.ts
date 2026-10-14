/**
 * Answer evaluation. Objective questions (MCQ, assertion–reason, fill in the blank, numerical) are marked
 * automatically, but only with a VALID answer key (see validKey). Descriptive questions, and objective questions
 * without a valid key, return `null` marks and are reviewed by the student against the official model answer.
 * A question with neither a valid key nor a model answer cannot be marked at all and is never put in a paper
 * (see eligibility.ts). An AI or teacher evaluator can later plug in by producing the same EvaluationResult shape.
 *
 * Rules (deliberate, tested in tests/engine.test.ts):
 *  - Unanswered auto-graded questions score 0; unanswered self-marked questions score 0 without review.
 *  - A wrong answer scores 0. There is no negative marking: no board paper in the bank prints a negative scheme.
 *  - Marks awarded never exceed the question's marks.
 *  - Fill in the blank: case, spacing, punctuation and Unicode subscripts are ignored; any listed alternative counts.
 *  - Numerical: the number must be within the key's stated tolerance (exact when none is stated). A unit typed after
 *    the number is accepted when the key states no unit or the same unit; a different unit is marked wrong (never converted).
 */
import type { QuestionType } from "@/db/schema";

export type AnswerKey =
  | { correctOption: number }
  | { accepted: string[] }
  | { value: number; tolerance: number; unit?: string }
  | null;

export type EvaluationResult = {
  isCorrect: boolean | null;
  marksAwarded: number | null;
  method: "AUTO" | "NONE";
};

export const AUTO_GRADED: QuestionType[] = ["MCQ", "ASSERTION_REASON", "FILL_BLANK", "NUMERICAL"];

/** Types that are answered by picking an option. */
export const OPTION_TYPES: QuestionType[] = ["MCQ", "ASSERTION_REASON"];

export function isAutoGraded(type: QuestionType): boolean {
  return AUTO_GRADED.includes(type);
}

/**
 * True when `key` can mark `type` reliably: an option index inside the options, a non-empty list of accepted
 * answers, or a finite value with a non-negative tolerance. Anything else is treated as "no key".
 * `optionCount` is only checked when given (option questions always have it in the app).
 */
export function validKey(type: QuestionType, key: AnswerKey | undefined, optionCount?: number): boolean {
  if (!key || !isAutoGraded(type)) return false;
  if (OPTION_TYPES.includes(type)) {
    if (!("correctOption" in key) || !Number.isInteger(key.correctOption) || key.correctOption < 0) return false;
    return optionCount === undefined || key.correctOption < optionCount;
  }
  if (type === "FILL_BLANK") return "accepted" in key && Array.isArray(key.accepted) && key.accepted.some((a) => typeof a === "string" && normaliseText(a) !== "");
  if (type === "NUMERICAL")
    return "value" in key && Number.isFinite(key.value) && (key.tolerance === undefined || (Number.isFinite(key.tolerance) && key.tolerance >= 0));
  return false;
}

/** A question is only marked automatically when it has a valid answer key; otherwise the student self-marks it. */
export function canAutoGrade(type: QuestionType, key: AnswerKey | undefined, optionCount?: number): boolean {
  return validKey(type, key, optionCount);
}

export function normaliseText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
    .replace(/[^\p{L}\p{N}+\-.]+/gu, " ")
    .replace(/\.(?=\s|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses "12.5", "12.5 cm", "1,200", "-3", "3/4" into a number. */
export function parseNumber(input: string): number | null {
  const s = input.replace(/,/g, "").replace(/−/g, "-").trim();
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  const m = s.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/i);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** The text after the number in a numerical response ("12.5 cm" → "cm"), or "" when there is none. */
function unitOf(input: string): string {
  const m = input.replace(/,/g, "").replace(/−/g, "-").match(/^\s*-?\d+(?:\.\d+)?(?:e-?\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?\s*(.*)$/i);
  return m ? normaliseText(m[1]) : "";
}

export function evaluate(type: QuestionType, key: AnswerKey, marks: number, response: string | null | undefined, optionCount?: number): EvaluationResult {
  if (!validKey(type, key, optionCount)) return { isCorrect: null, marksAwarded: null, method: "NONE" };
  const max = Math.max(0, marks);
  const answered = response !== null && response !== undefined && String(response).trim() !== "";
  if (!answered) return { isCorrect: false, marksAwarded: 0, method: "AUTO" };
  const r = String(response).trim();
  let correct = false;
  if (OPTION_TYPES.includes(type) && key && "correctOption" in key) {
    // The response is the chosen option's index; anything else (free text, out of range) is wrong, never coerced.
    correct = /^\d+$/.test(r) && Number(r) === key.correctOption && (optionCount === undefined || Number(r) < optionCount);
  } else if (type === "FILL_BLANK" && key && "accepted" in key) {
    const given = normaliseText(r);
    correct = given !== "" && key.accepted.some((a) => normaliseText(a) === given);
  } else if (type === "NUMERICAL" && key && "value" in key) {
    const n = parseNumber(r);
    const tol = Math.max(key.tolerance ?? 0, Math.abs(key.value) * 1e-9);
    const unit = unitOf(r);
    const unitOk = unit === "" || key.unit === undefined || unit === normaliseText(key.unit);
    correct = n !== null && unitOk && Math.abs(n - key.value) <= tol;
  }
  return { isCorrect: correct, marksAwarded: correct ? max : 0, method: "AUTO" };
}
