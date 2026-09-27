/**
 * Answer evaluation. Objective questions (MCQ, fill in the blank, numerical) are marked automatically.
 * Descriptive questions return `null` and are reviewed by the student against the model answer.
 * An AI or teacher evaluator can later plug in by producing the same EvaluationResult shape.
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

export const AUTO_GRADED: QuestionType[] = ["MCQ", "FILL_BLANK", "NUMERICAL"];

export function isAutoGraded(type: QuestionType): boolean {
  return AUTO_GRADED.includes(type);
}

function normaliseText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
    .replace(/[^\p{L}\p{N}+\-.]+/gu, " ")
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

export function evaluate(type: QuestionType, key: AnswerKey, marks: number, response: string | null | undefined): EvaluationResult {
  const answered = response !== null && response !== undefined && String(response).trim() !== "";
  if (!isAutoGraded(type) || !key) return { isCorrect: null, marksAwarded: null, method: "NONE" };
  if (!answered) return { isCorrect: false, marksAwarded: 0, method: "AUTO" };
  const r = String(response);
  let correct = false;
  if (type === "MCQ" && "correctOption" in key) {
    correct = Number(r) === key.correctOption;
  } else if (type === "FILL_BLANK" && "accepted" in key) {
    const given = normaliseText(r);
    correct = key.accepted.some((a) => normaliseText(a) === given);
  } else if (type === "NUMERICAL" && "value" in key) {
    const n = parseNumber(r);
    const tol = Math.max(key.tolerance ?? 0, Math.abs(key.value) * 1e-9);
    correct = n !== null && Math.abs(n - key.value) <= tol;
  }
  return { isCorrect: correct, marksAwarded: correct ? marks : 0, method: "AUTO" };
}
