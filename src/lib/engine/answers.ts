/**
 * Answer completion workflow. Pure functions (no database), unit tested in tests/answers.test.ts.
 *
 * Statuses of a question's answer (adapted to the existing schema):
 *  - OFFICIAL         answer_source OFFICIAL_SCHEME: the board's own answer / marking scheme, checked against it.
 *  - EDITOR_REVIEWED  answer_source EDITOR: an original model answer written or reviewed by an ExamReady editor.
 *                     It is never labelled official.
 *  - AI_PRACTICE      answer_source AI: AI-written answers on AI practice questions only.
 *  - MISSING          nothing published.
 * A draft (answer_draft) is separate: AI_DRAFT (written by AI, not reviewed) or EDITOR_DRAFT (saved, not published).
 * Drafts are never shown to students and never used for marking; only `planPublish` turns one into the published
 * answer, and only an editor action calls it.
 */
import type { AnswerDraft, AnswerMeta, AnswerSource, AnswerSourceRef, QuestionType } from "@/db/schema";
import { validKey, type AnswerKey } from "./grading.ts";

export type PublishedStatus = "OFFICIAL" | "EDITOR_REVIEWED" | "AI_PRACTICE" | "MISSING";
export type DraftStatus = "AI_DRAFT" | "EDITOR_DRAFT" | null;

export function publishedStatus(q: { answerSource: AnswerSource | string; answerText: string; answerKey: AnswerKey | null | undefined }): PublishedStatus {
  const has = q.answerText.trim() !== "" || Boolean(q.answerKey);
  if (!has) return "MISSING";
  if (q.answerSource === "OFFICIAL_SCHEME") return "OFFICIAL";
  if (q.answerSource === "AI") return "AI_PRACTICE";
  // EDITOR, or an answer with no recorded source: an ExamReady answer, never an official one.
  return "EDITOR_REVIEWED";
}

export function draftStatus(draft: AnswerDraft | null | undefined): DraftStatus {
  if (!draft) return null;
  return draft.origin === "AI" ? "AI_DRAFT" : "EDITOR_DRAFT";
}

export const STATUS_LABELS: Record<PublishedStatus | "AI_DRAFT" | "EDITOR_DRAFT", string> = {
  OFFICIAL: "Official answer (checked against its source)",
  EDITOR_REVIEWED: "Model answer reviewed by an ExamReady editor (not official)",
  AI_PRACTICE: "AI-written answer (AI practice question)",
  MISSING: "No answer published",
  AI_DRAFT: "AI-generated draft, not reviewed",
  EDITOR_DRAFT: "Editor draft, not published",
};

const OPTION_TYPES = new Set(["MCQ", "ASSERTION_REASON"]);
const DESCRIPTIVE = new Set(["SHORT_ANSWER", "LONG_ANSWER", "CASE_BASED"]);

/**
 * Checks a draft before it is saved or published. Returns field → message (empty when valid).
 * A numerical tolerance above 0 needs a note saying why (the brief: tolerances must be justified).
 */
export function validateDraft(type: QuestionType | string, options: string[] | null | undefined, d: Partial<AnswerDraft>): Record<string, string> {
  const e: Record<string, string> = {};
  const text = (d.text ?? "").trim();
  const key = d.key ?? null;
  if (!text && !key) e.text = "Write a model answer or an answer key.";
  if (text.length > 10000) e.text = "The model answer is too long (10,000 characters at most).";
  if (key) {
    if (OPTION_TYPES.has(type)) {
      const n = options?.filter((o) => o.trim() !== "").length ?? 0;
      if (!("correctOption" in key) || !validKey(type as QuestionType, key, n)) e.key = "Choose one of the question's options as the correct answer.";
    } else if (type === "FILL_BLANK") {
      if (!("accepted" in key) || !validKey("FILL_BLANK", key)) e.key = "Add at least one accepted answer.";
    } else if (type === "NUMERICAL") {
      if (!("value" in key) || !validKey("NUMERICAL", key)) e.key = "Enter the value as a number and a tolerance of 0 or more.";
      else if ((key.tolerance ?? 0) > 0 && !(d.notes ?? "").trim()) e.notes = "Say why a tolerance is allowed (for example, rounding stated in the question).";
    } else {
      e.key = "Written questions are marked against the model answer and rubric, not an answer key.";
    }
  }
  if (d.rubric && d.rubric.length > 5000) e.rubric = "The rubric is too long (5,000 characters at most).";
  if (d.rubric && !DESCRIPTIVE.has(type) && !text) e.rubric = "Add the model answer the rubric belongs to.";
  if (d.practiceMarks !== undefined && d.practiceMarks !== null && (!Number.isInteger(d.practiceMarks) || d.practiceMarks < 1 || d.practiceMarks > 20))
    e.practiceMarks = "Suggested practice marks must be a whole number from 1 to 20 (or left empty).";
  if (d.source?.url && !/^https:\/\//.test(d.source.url)) e.source = "The source link must start with https://.";
  return e;
}

export type PublishRequest = {
  /** Publish as the board's official answer. Allowed only with a named source the editor confirms they checked. */
  asOfficial: boolean;
  sourceChecked: boolean;
  source?: AnswerSourceRef;
  editor: string;
  at: string;
};

export type PublishPlan = {
  answerSource: AnswerSource;
  answerText: string;
  answerKey: string | null;
  answerRubric: string;
  answerMeta: AnswerMeta;
  practiceMarks: number | null | undefined;
};

/**
 * What publishing a draft writes. An AI draft can only be published by an editor, and then it is the editor's
 * reviewed answer (EDITOR), never AI-authoritative and never official unless the source was checked.
 */
export function planPublish(
  type: QuestionType | string,
  options: string[] | null | undefined,
  draft: AnswerDraft,
  req: PublishRequest,
): { ok: true; plan: PublishPlan } | { ok: false; errors: Record<string, string> } {
  const errors = validateDraft(type, options, draft);
  const source = req.source ?? draft.source;
  if (req.asOfficial) {
    if (!source?.title?.trim()) errors.source = "Name the official source (paper or marking scheme) the answer was checked against.";
    else if (!source.url?.trim() && !source.questionNumber?.trim()) errors.source = "Give the source link or the question number in that source.";
    if (!req.sourceChecked) errors.sourceChecked = "Confirm that you checked this answer against the official source.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    plan: {
      answerSource: req.asOfficial ? "OFFICIAL_SCHEME" : "EDITOR",
      answerText: (draft.text ?? "").trim(),
      answerKey: draft.key ? JSON.stringify(draft.key) : null,
      answerRubric: (draft.rubric ?? "").trim(),
      answerMeta: { reviewedBy: req.editor, reviewedAt: req.at, ...(source ? { source } : {}), sourceChecked: req.asOfficial ? true : Boolean(req.sourceChecked && source?.title) },
      practiceMarks: draft.practiceMarks,
    },
  };
}

/** Review-queue issues for a question (the admin answers page filters on these; SQL mirrors live in data/answers.ts). */
export type AnswerIssue = "NO_KEY" | "NO_MARKS" | "OPTIONS" | "NO_RUBRIC" | "INVALID_TYPE" | "INCOMPLETE_SOURCE" | "AI_DRAFT" | "EDITOR_DRAFT" | "SOURCE_UNCHECKED";

export function answerIssues(q: {
  type: string;
  marks: number;
  marksStatus: string;
  options: string[] | null;
  answerKey: AnswerKey | null;
  answerText: string;
  answerRubric: string;
  answerSource: string;
  answerMeta: AnswerMeta | null;
  answerDraft: AnswerDraft | null;
  hasFigure: boolean;
  figureCount: number;
  lowConfidence: boolean;
  sourceLinks: number;
}): AnswerIssue[] {
  const out: AnswerIssue[] = [];
  const known = ["MCQ", "ASSERTION_REASON", "FILL_BLANK", "NUMERICAL", "SHORT_ANSWER", "LONG_ANSWER", "CASE_BASED"].includes(q.type);
  if (!known) out.push("INVALID_TYPE");
  if (known && ["MCQ", "ASSERTION_REASON", "FILL_BLANK", "NUMERICAL"].includes(q.type)) {
    const n = OPTION_TYPES.has(q.type) ? (q.options?.filter((o) => o.trim()).length ?? 0) : undefined;
    if (!validKey(q.type as QuestionType, q.answerKey, n)) out.push("NO_KEY");
  }
  if (q.marksStatus !== "PRINTED" || !(q.marks > 0)) out.push("NO_MARKS");
  if (OPTION_TYPES.has(q.type) && (q.options?.filter((o) => o.trim()).length ?? 0) < 2) out.push("OPTIONS");
  if (DESCRIPTIVE.has(q.type) && !q.answerText.trim()) out.push("NO_RUBRIC");
  if ((q.hasFigure && q.figureCount === 0) || q.lowConfidence || q.sourceLinks === 0) out.push("INCOMPLETE_SOURCE");
  if (q.answerDraft?.origin === "AI") out.push("AI_DRAFT");
  if (q.answerDraft?.origin === "EDITOR") out.push("EDITOR_DRAFT");
  if (q.answerSource === "EDITOR" && q.answerMeta?.source?.title && !q.answerMeta.sourceChecked) out.push("SOURCE_UNCHECKED");
  return out;
}
