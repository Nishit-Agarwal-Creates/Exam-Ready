/**
 * Whether a question may be put into a generated (and therefore marked) paper, and why not.
 * One definition, used by the paper builder, the estimate, the admin question list and the tests.
 *
 * A paper question must be markable:
 *  - its own mark is printed (marks status PRINTED) and is a positive whole number, and
 *  - it is either marked automatically (an answer key that validKey accepts) or the student can self-mark it
 *    against an official model answer. A question with neither would leave the student nothing to mark against,
 *    so it stays browsable as a PYQ but is never drawn into a paper.
 * Nothing here invents an answer or a mark: a question that fails stays out until an editor adds the evidence.
 */
import type { MarksStatus, QuestionType } from "@/db/schema";
import { OPTION_TYPES, isAutoGraded, validKey, type AnswerKey } from "./grading.ts";

export type GradingMode = "AUTO" | "SELF_REVIEW" | "NONE";

export type EligibilityInput = {
  type: string;
  marks: number | null | undefined;
  marksStatus?: MarksStatus | string | null;
  options?: string[] | null;
  answerKey?: AnswerKey | undefined;
  /** True when the question has an official model answer / marking-scheme text. */
  hasModelAnswer: boolean;
};

export type Eligibility = { eligible: boolean; mode: GradingMode; reasons: string[] };

const TYPES = new Set(["MCQ", "ASSERTION_REASON", "FILL_BLANK", "NUMERICAL", "SHORT_ANSWER", "LONG_ANSWER", "CASE_BASED"]);

/** How an answer to this question is marked, from the evidence stored with it. */
export function gradingModeOf(q: Pick<EligibilityInput, "type" | "options" | "answerKey" | "hasModelAnswer">): GradingMode {
  if (!TYPES.has(q.type)) return "NONE";
  const type = q.type as QuestionType;
  const isOption = OPTION_TYPES.includes(type);
  const optionCount = isOption ? (q.options?.filter((o) => o.trim() !== "").length ?? 0) : undefined;
  if (isAutoGraded(type) && (!isOption || (optionCount ?? 0) >= 2) && validKey(type, q.answerKey, optionCount)) return "AUTO";
  return q.hasModelAnswer ? "SELF_REVIEW" : "NONE";
}

export function paperEligibility(q: EligibilityInput): Eligibility {
  const reasons: string[] = [];
  if (!TYPES.has(q.type)) reasons.push(`Unknown question type "${q.type}".`);
  const status = q.marksStatus ?? "PRINTED";
  if (status !== "PRINTED") {
    reasons.push(
      status === "GROUP_TOTAL"
        ? "Only a total for its whole group is printed, so it has no mark of its own."
        : status === "FRACTIONAL"
          ? "Its printed mark is a fraction, which a generated paper can't use."
          : "The paper prints no mark for it.",
    );
  } else if (q.marks === null || q.marks === undefined || !Number.isInteger(q.marks) || q.marks <= 0) {
    reasons.push("Its marks are missing or not a positive whole number.");
  }
  if (TYPES.has(q.type) && OPTION_TYPES.includes(q.type as QuestionType)) {
    const n = q.options?.filter((o) => o.trim() !== "").length ?? 0;
    if (n < 2) reasons.push("It is a choice question but its options aren't available as text.");
    else if (q.answerKey && !validKey(q.type as QuestionType, q.answerKey, n)) reasons.push("Its answer key points to an option that doesn't exist.");
  }
  const mode = gradingModeOf(q);
  if (mode === "NONE") reasons.push("It has no answer key or official model answer to mark against.");
  return { eligible: reasons.length === 0, mode, reasons };
}
