/**
 * Answer-and-marks review queue (admin). Finds questions whose answer, marks or source information is incomplete,
 * and saves, publishes or discards answer drafts. Drafts live in questions.answer_draft and are never shown to students
 * or used for marking; publishing (an editor action) is the only way a draft becomes the question's answer, and an
 * answer is labelled official only when the editor names the source and confirms they checked it (engine/answers.ts).
 */
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AnswerDraft, AnswerMeta, AnswerSourceRef } from "@/db/schema";
import { answerIssues, draftStatus, planPublish, publishedStatus, validateDraft, type AnswerIssue, type PublishRequest } from "@/lib/engine/answers";
import { paperEligibility } from "@/lib/engine/eligibility";
import type { AnswerKey } from "@/lib/engine/grading";
import { safeJson } from "@/lib/text";
import { getSourcesFor } from "./questions";

const { questions, chapters, subjects, classes, boards } = schema;

export const ANSWER_ISSUES: { key: AnswerIssue; label: string; hint: string }[] = [
  { key: "NO_KEY", label: "Missing answer key", hint: "Choice, fill-in and numerical questions with no valid key." },
  { key: "NO_MARKS", label: "Missing individual marks", hint: "The paper prints only a group total, a fraction, or no mark." },
  { key: "OPTIONS", label: "Options missing", hint: "Choice questions whose options aren't stored as text." },
  { key: "NO_RUBRIC", label: "Missing descriptive answer", hint: "Written questions with no model answer or marking scheme." },
  { key: "INVALID_TYPE", label: "Invalid question type", hint: "A type the app doesn't know." },
  { key: "INCOMPLETE_SOURCE", label: "Figure, context or source incomplete", hint: "Needs a figure that isn't attached, low extraction confidence, or no linked source." },
  { key: "AI_DRAFT", label: "AI drafts awaiting review", hint: "Written by AI; not shown to students until an editor publishes them." },
  { key: "EDITOR_DRAFT", label: "Editor drafts not published", hint: "Saved by an editor but not published yet." },
  { key: "SOURCE_UNCHECKED", label: "Reviewed answers awaiting source check", hint: "Editor-reviewed answers that cite a source nobody has checked yet." },
];

const AUTO_TYPES = sql.raw(`('MCQ', 'ASSERTION_REASON', 'FILL_BLANK', 'NUMERICAL')`);
const OPTION_TYPES = sql.raw(`('MCQ', 'ASSERTION_REASON')`);
const DESCRIPTIVE = sql.raw(`('SHORT_ANSWER', 'LONG_ANSWER', 'CASE_BASED')`);
const KNOWN = sql.raw(`('MCQ', 'ASSERTION_REASON', 'FILL_BLANK', 'NUMERICAL', 'SHORT_ANSWER', 'LONG_ANSWER', 'CASE_BASED')`);
const QID = sql.raw(`"questions"."id"`);

/** SQL for each issue (null-safe). Mirrors answerIssues in engine/answers.ts, which also checks key ranges per row. */
function issueSql(issue: AnswerIssue): SQL {
  switch (issue) {
    case "NO_KEY":
      return sql`(${questions.questionType} IN ${AUTO_TYPES} AND COALESCE(${questions.answerKey}, '') = '')`;
    case "NO_MARKS":
      return sql`(${questions.marksStatus} <> 'PRINTED' OR COALESCE(${questions.marks}, 0) <= 0)`;
    case "OPTIONS":
      return sql`(${questions.questionType} IN ${OPTION_TYPES} AND NOT (json_valid(COALESCE(${questions.options}, '')) = 1 AND json_array_length(${questions.options}) >= 2))`;
    case "NO_RUBRIC":
      return sql`(${questions.questionType} IN ${DESCRIPTIVE} AND COALESCE(${questions.answerText}, '') = '')`;
    case "INVALID_TYPE":
      return sql`(${questions.questionType} NOT IN ${KNOWN})`;
    case "INCOMPLETE_SOURCE":
      return sql`((${questions.hasFigure} = 1 AND ${questions.figure} IS NULL) OR ${questions.extractionConfidence} = 'LOW' OR NOT EXISTS (SELECT 1 FROM question_sources qs WHERE qs.question_id = ${QID}))`;
    case "AI_DRAFT":
      return sql`(json_valid(COALESCE(${questions.answerDraft}, '')) = 1 AND json_extract(${questions.answerDraft}, '$.origin') = 'AI')`;
    case "EDITOR_DRAFT":
      return sql`(json_valid(COALESCE(${questions.answerDraft}, '')) = 1 AND json_extract(${questions.answerDraft}, '$.origin') = 'EDITOR')`;
    case "SOURCE_UNCHECKED":
      return sql`(${questions.answerSource} = 'EDITOR' AND json_valid(COALESCE(${questions.answerMeta}, '')) = 1 AND json_extract(${questions.answerMeta}, '$.source.title') IS NOT NULL AND COALESCE(json_extract(${questions.answerMeta}, '$.sourceChecked'), 0) = 0)`;
  }
}

export type AnswerQueueFilters = {
  issue?: AnswerIssue;
  boardId?: number;
  classId?: number;
  subjectId?: number;
  includeUnpublished?: boolean;
  page?: number;
  /** Rows per page (the CSV export reads larger pages). */
  pageSize?: number;
};

function baseConds(f: AnswerQueueFilters): SQL[] {
  const conds: SQL[] = [eq(questions.isDemo, false)];
  // The queue works on the live bank by default (published, not rejected); editors can widen it.
  if (!f.includeUnpublished) conds.push(eq(questions.isPublished, true), sql`${questions.verificationStatus} <> 'REJECTED'`);
  if (f.boardId) conds.push(eq(questions.boardId, f.boardId));
  if (f.classId) conds.push(eq(questions.classId, f.classId));
  if (f.subjectId) conds.push(eq(questions.subjectId, f.subjectId));
  return conds;
}

/** Number of questions with each issue, so the remaining work is measurable. */
export async function answerIssueCounts(f: AnswerQueueFilters = {}): Promise<Record<AnswerIssue | "TOTAL" | "NOT_TEST_READY", number>> {
  const db = await getDb();
  const cols = Object.fromEntries(ANSWER_ISSUES.map((i) => [i.key, sql<number>`SUM(CASE WHEN ${issueSql(i.key)} THEN 1 ELSE 0 END)`]));
  const [row] = await db
    .select({ TOTAL: sql<number>`COUNT(*)`, ...cols })
    .from(questions)
    .where(and(...baseConds(f)));
  const out = Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, Number(v ?? 0)])) as Record<AnswerIssue | "TOTAL", number>;
  return { ...out, NOT_TEST_READY: 0 };
}

const PAGE = 25;

export async function answerQueue(f: AnswerQueueFilters) {
  const db = await getDb();
  const conds = baseConds(f);
  if (f.issue) conds.push(issueSql(f.issue));
  const where = and(...conds);
  const [{ n }] = await db.select({ n: sql<number>`COUNT(*)` }).from(questions).where(where);
  const page = Math.max(1, f.page ?? 1);
  const size = Math.min(Math.max(f.pageSize ?? PAGE, 1), 500);
  const rows = await db
    .select({
      id: questions.id,
      externalKey: questions.externalKey,
      text: questions.questionText,
      type: questions.questionType,
      marks: questions.marks,
      marksStatus: questions.marksStatus,
      marksNote: questions.marksNote,
      practiceMarks: questions.practiceMarks,
      options: questions.options,
      answerKey: questions.answerKey,
      answerText: questions.answerText,
      answerRubric: questions.answerRubric,
      answerSource: questions.answerSource,
      answerMeta: questions.answerMeta,
      answerDraft: questions.answerDraft,
      hasFigure: questions.hasFigure,
      figure: questions.figure,
      confidence: questions.extractionConfidence,
      board: boards.name,
      className: classes.name,
      subject: subjects.name,
      chapter: chapters.name,
    })
    .from(questions)
    .innerJoin(chapters, eq(questions.chapterId, chapters.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(classes, eq(questions.classId, classes.id))
    .innerJoin(boards, eq(questions.boardId, boards.id))
    .where(where)
    .orderBy(asc(questions.subjectId), asc(questions.chapterId), asc(questions.id))
    .limit(size)
    .offset((page - 1) * size);
  const sources = await getSourcesFor(rows.map((r) => r.id));
  return { total: Number(n), page, pages: Math.max(1, Math.ceil(Number(n) / size)), items: rows.map((r) => describeRow(r, sources.get(r.id) ?? [])) };
}

type QueueRow = {
  id: number;
  externalKey: string | null;
  text: string;
  type: string;
  marks: number;
  marksStatus: string;
  marksNote: string;
  practiceMarks: number | null;
  options: string | null;
  answerKey: string | null;
  answerText: string;
  answerRubric: string;
  answerSource: string;
  answerMeta: string | null;
  answerDraft: string | null;
  hasFigure: boolean;
  figure: string | null;
  confidence: string | null;
  board: string;
  className: string;
  subject: string;
  chapter: string;
};

function describeRow(r: QueueRow, sources: { title: string; year: number | null; questionNumber: string | null; pageNumber?: number | null }[]) {
  const options = safeJson<string[] | null>(r.options, null);
  const key = safeJson<AnswerKey>(r.answerKey, null);
  const draft = safeJson<AnswerDraft | null>(r.answerDraft, null);
  const meta = safeJson<AnswerMeta | null>(r.answerMeta, null);
  const fit = paperEligibility({ type: r.type, marks: r.marks, marksStatus: r.marksStatus, options, answerKey: key, hasModelAnswer: r.answerText.trim() !== "" });
  const issues = answerIssues({
    type: r.type,
    marks: r.marks,
    marksStatus: r.marksStatus,
    options,
    answerKey: key,
    answerText: r.answerText,
    answerRubric: r.answerRubric,
    answerSource: r.answerSource,
    answerMeta: meta,
    answerDraft: draft,
    hasFigure: r.hasFigure,
    figureCount: safeJson<unknown[]>(r.figure, [])?.length ?? 0,
    lowConfidence: r.confidence === "LOW",
    sourceLinks: sources.length,
  });
  const s = sources[0];
  return {
    ...r,
    options,
    key,
    draft,
    meta,
    status: publishedStatus({ answerSource: r.answerSource, answerText: r.answerText, answerKey: key }),
    draftStatus: draftStatus(draft),
    issues,
    testReasons: fit.reasons,
    testReady: fit.eligible,
    sourceRef: s ? `${s.title}${s.year ? ` (${s.year})` : ""}${s.questionNumber ? `, Q${s.questionNumber}` : ""}${s.pageNumber ? `, p. ${s.pageNumber}` : ""}` : "No linked source",
  };
}

export async function getAnswerWork(id: number) {
  const db = await getDb();
  const [r] = await db
    .select({
      id: questions.id,
      externalKey: questions.externalKey,
      text: questions.questionText,
      type: questions.questionType,
      marks: questions.marks,
      marksStatus: questions.marksStatus,
      marksNote: questions.marksNote,
      practiceMarks: questions.practiceMarks,
      options: questions.options,
      answerKey: questions.answerKey,
      answerText: questions.answerText,
      answerRubric: questions.answerRubric,
      answerSource: questions.answerSource,
      answerMeta: questions.answerMeta,
      answerDraft: questions.answerDraft,
      hasFigure: questions.hasFigure,
      figure: questions.figure,
      confidence: questions.extractionConfidence,
      board: boards.name,
      className: classes.name,
      subject: subjects.name,
      chapter: chapters.name,
    })
    .from(questions)
    .innerJoin(chapters, eq(questions.chapterId, chapters.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(classes, eq(questions.classId, classes.id))
    .innerJoin(boards, eq(questions.boardId, boards.id))
    .where(eq(questions.id, id));
  if (!r) return null;
  const sources = (await getSourcesFor([id])).get(id) ?? [];
  return { ...describeRow(r, sources), sources };
}

export type DraftInput = Omit<AnswerDraft, "origin" | "savedBy" | "savedAt">;

/** Saves an editor draft (the live answer is untouched). */
export async function saveAnswerDraft(id: number, input: DraftInput, editor: string): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const db = await getDb();
  const [q] = await db.select({ type: questions.questionType, options: questions.options }).from(questions).where(eq(questions.id, id));
  if (!q) return { ok: false, errors: { form: "This question no longer exists." } };
  const errors = validateDraft(q.type, safeJson<string[] | null>(q.options, null), input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const draft: AnswerDraft = { ...input, origin: "EDITOR", savedBy: editor, savedAt: new Date().toISOString() };
  await db.update(questions).set({ answerDraft: JSON.stringify(draft), updatedAt: new Date().toISOString() }).where(eq(questions.id, id));
  return { ok: true };
}

/**
 * Publishes the draft as the question's answer. Only the answer fields (and the practice-marks suggestion) change;
 * question text, marks, chapter, sources and verification are untouched. The draft is cleared afterwards.
 */
export async function publishAnswerDraft(
  id: number,
  input: DraftInput,
  req: Omit<PublishRequest, "editor" | "at">,
  editor: string,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const db = await getDb();
  const [q] = await db.select({ type: questions.questionType, options: questions.options, draft: questions.answerDraft }).from(questions).where(eq(questions.id, id));
  if (!q) return { ok: false, errors: { form: "This question no longer exists." } };
  const prior = safeJson<AnswerDraft | null>(q.draft, null);
  // Publishing an AI draft makes it the editor's reviewed answer: the editor submits the (possibly corrected) text.
  const draft: AnswerDraft = { ...input, origin: "EDITOR", notes: [input.notes, prior?.origin === "AI" ? "Reviewed from an AI draft." : ""].filter(Boolean).join(" ") };
  const now = new Date().toISOString();
  const res = planPublish(q.type, safeJson<string[] | null>(q.options, null), draft, { ...req, editor, at: now });
  if (!res.ok) return res;
  const p = res.plan;
  await db
    .update(questions)
    .set({
      answerSource: p.answerSource,
      answerText: p.answerText,
      answerKey: p.answerKey,
      answerRubric: p.answerRubric,
      answerMeta: JSON.stringify(p.answerMeta),
      ...(p.practiceMarks !== undefined ? { practiceMarks: p.practiceMarks } : {}),
      answerDraft: null,
      updatedAt: now,
    })
    .where(eq(questions.id, id));
  return { ok: true };
}

export async function discardAnswerDraft(id: number): Promise<void> {
  const db = await getDb();
  await db.update(questions).set({ answerDraft: null, updatedAt: new Date().toISOString() }).where(eq(questions.id, id));
}

/** CSV export of the queue (admin only), with spreadsheet formula injection neutralised. */
export async function answerQueueCsv(f: AnswerQueueFilters): Promise<string> {
  const header = ["id", "external_key", "board", "class", "subject", "chapter", "type", "marks", "marks_status", "answer_status", "draft", "source", "issues", "not_in_tests_because"];
  const lines = [header.join(",")];
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (let page = 1; page <= 40; page++) {
    const res = await answerQueue({ ...f, page, pageSize: 500 });
    for (const r of res.items)
      lines.push(
        [r.id, r.externalKey, r.board, r.className, r.subject, r.chapter, r.type, r.marks, r.marksStatus, r.status, r.draftStatus ?? "", r.sourceRef, r.issues.join(" "), r.testReasons.join(" ")]
          .map(cell)
          .join(","),
      );
    if (page >= res.pages) break;
  }
  return lines.join("\r\n") + "\r\n";
}

export type { AnswerSourceRef };
