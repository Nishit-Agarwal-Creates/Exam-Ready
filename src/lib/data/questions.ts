import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Difficulty, QuestionType, SourceType, VerificationStatus } from "@/db/schema";
import type { PoolQuestion } from "@/lib/engine/generator";
import type { AnswerKey } from "@/lib/engine/grading";
import type { SourceLink } from "@/lib/provenance";
import { safeJson } from "@/lib/text";

const { questions, questionSources, papers, chapters, topics } = schema;

/** D1 allows at most 100 bound parameters per statement. */
export function chunk<T>(arr: T[], size = 90): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function getPool(subjectId: number, chapterIds: number[], includeDemo: boolean): Promise<PoolQuestion[]> {
  const db = await getDb();
  const conds: SQL[] = [eq(questions.subjectId, subjectId)];
  if (chapterIds.length) conds.push(inArray(questions.chapterId, chapterIds));
  if (!includeDemo) conds.push(eq(questions.isDemo, false));
  return db
    .select({
      id: questions.id,
      chapterId: questions.chapterId,
      topicId: questions.topicId,
      questionType: questions.questionType,
      marks: questions.marks,
      difficulty: questions.difficulty,
      sourceType: questions.sourceType,
      verificationStatus: questions.verificationStatus,
      isPublished: questions.isPublished,
      isDemo: questions.isDemo,
    })
    .from(questions)
    .where(and(...conds));
}

export type QuestionView = {
  id: number;
  text: string;
  type: QuestionType;
  marks: number;
  difficulty: Difficulty;
  options: string[] | null;
  chapter: { id: number; name: string; slug: string };
  topic: { id: number; name: string } | null;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  isPublished: boolean;
  frequencyCount: number;
  sources: SourceLink[];
  /** Only present when answers are requested (never during an exam). */
  answer?: { text: string; explanation: string; key: AnswerKey };
};

export async function getSourcesFor(ids: number[]): Promise<Map<number, SourceLink[]>> {
  const db = await getDb();
  const map = new Map<number, SourceLink[]>();
  for (const part of chunk(ids)) {
    if (!part.length) continue;
    const rows = await db
      .select({
        questionId: questionSources.questionId,
        paperId: papers.id,
        title: papers.title,
        year: papers.year,
        paperType: papers.paperType,
        sourceUrl: papers.sourceUrl,
        questionNumber: questionSources.questionNumber,
        isDemo: papers.isDemo,
        isPrimary: questionSources.isPrimary,
      })
      .from(questionSources)
      .innerJoin(papers, eq(questionSources.paperId, papers.id))
      .where(inArray(questionSources.questionId, part))
      .orderBy(desc(questionSources.isPrimary), desc(papers.year));
    for (const r of rows) {
      const list = map.get(r.questionId) ?? [];
      list.push({
        paperId: r.paperId,
        title: r.title,
        year: r.year,
        paperType: r.paperType,
        sourceUrl: r.sourceUrl,
        questionNumber: r.questionNumber,
        isDemo: r.isDemo,
      });
      map.set(r.questionId, list);
    }
  }
  return map;
}

const viewColumns = {
  id: questions.id,
  text: questions.questionText,
  type: questions.questionType,
  marks: questions.marks,
  difficulty: questions.difficulty,
  options: questions.options,
  answerKey: questions.answerKey,
  answerText: questions.answerText,
  explanation: questions.explanation,
  sourceType: questions.sourceType,
  verificationStatus: questions.verificationStatus,
  isDemo: questions.isDemo,
  isPublished: questions.isPublished,
  frequencyCount: questions.frequencyCount,
  chapterId: chapters.id,
  chapterName: chapters.name,
  chapterSlug: chapters.slug,
  topicId: topics.id,
  topicName: topics.name,
};

type ViewRow = {
  id: number;
  text: string;
  type: QuestionType;
  marks: number;
  difficulty: Difficulty;
  options: string | null;
  answerKey: string | null;
  answerText: string;
  explanation: string;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  isPublished: boolean;
  frequencyCount: number;
  chapterId: number;
  chapterName: string;
  chapterSlug: string;
  topicId: number | null;
  topicName: string | null;
};

function toView(r: ViewRow, sources: SourceLink[], withAnswers: boolean): QuestionView {
  return {
    id: r.id,
    text: r.text,
    type: r.type,
    marks: r.marks,
    difficulty: r.difficulty,
    options: safeJson<string[] | null>(r.options, null),
    chapter: { id: r.chapterId, name: r.chapterName, slug: r.chapterSlug },
    topic: r.topicId && r.topicName ? { id: r.topicId, name: r.topicName } : null,
    sourceType: r.sourceType,
    verificationStatus: r.verificationStatus,
    isDemo: r.isDemo,
    isPublished: r.isPublished,
    frequencyCount: r.frequencyCount,
    sources,
    ...(withAnswers ? { answer: { text: r.answerText, explanation: r.explanation, key: safeJson<AnswerKey>(r.answerKey, null) } } : {}),
  };
}

export async function getQuestionViews(ids: number[], withAnswers: boolean): Promise<Map<number, QuestionView>> {
  const db = await getDb();
  const out = new Map<number, QuestionView>();
  const sources = await getSourcesFor(ids);
  for (const part of chunk(ids)) {
    if (!part.length) continue;
    const rows = await db
      .select(viewColumns)
      .from(questions)
      .innerJoin(chapters, eq(questions.chapterId, chapters.id))
      .leftJoin(topics, eq(questions.topicId, topics.id))
      .where(inArray(questions.id, part));
    for (const r of rows) out.set(r.id, toView(r, sources.get(r.id) ?? [], withAnswers));
  }
  return out;
}

export type QuestionFilters = {
  subjectId?: number;
  chapterId?: number;
  sourceType?: SourceType;
  status?: VerificationStatus;
  type?: QuestionType;
  difficulty?: Difficulty;
  q?: string;
  demo?: "only" | "exclude";
  /** Public browsing only shows published, reviewed questions. */
  publicOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export async function searchQuestions(f: QuestionFilters, withAnswers: boolean) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (f.subjectId) conds.push(eq(questions.subjectId, f.subjectId));
  if (f.chapterId) conds.push(eq(questions.chapterId, f.chapterId));
  if (f.sourceType) conds.push(eq(questions.sourceType, f.sourceType));
  if (f.status) conds.push(eq(questions.verificationStatus, f.status));
  if (f.type) conds.push(eq(questions.questionType, f.type));
  if (f.difficulty) conds.push(eq(questions.difficulty, f.difficulty));
  if (f.demo === "only") conds.push(eq(questions.isDemo, true));
  if (f.demo === "exclude") conds.push(eq(questions.isDemo, false));
  if (f.publicOnly) conds.push(eq(questions.isPublished, true), eq(questions.verificationStatus, "VERIFIED"));
  if (f.q && f.q.trim()) {
    const term = `%${f.q.trim().replace(/[%_]/g, "")}%`;
    conds.push(or(like(questions.questionText, term), like(questions.externalKey, term))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const pageSize = Math.min(Math.max(f.pageSize ?? 20, 1), 100);
  const page = Math.max(f.page ?? 1, 1);
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(questions).where(where);
  const rows = await db
    .select(viewColumns)
    .from(questions)
    .innerJoin(chapters, eq(questions.chapterId, chapters.id))
    .leftJoin(topics, eq(questions.topicId, topics.id))
    .where(where)
    .orderBy(asc(chapters.sortOrder), asc(questions.marks), asc(questions.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const sources = await getSourcesFor(rows.map((r) => r.id));
  return {
    total: Number(n),
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(Number(n) / pageSize)),
    items: rows.map((r) => toView(r, sources.get(r.id) ?? [], withAnswers)),
  };
}

/** Recomputes the cached frequency count from stored board-exam links. */
export async function refreshFrequency(questionId: number): Promise<void> {
  const db = await getDb();
  const [q] = await db.select({ isDemo: questions.isDemo }).from(questions).where(eq(questions.id, questionId));
  if (!q) return;
  const [{ n }] = await db
    .select({ n: sql<number>`count(distinct ${papers.id})` })
    .from(questionSources)
    .innerJoin(papers, eq(questionSources.paperId, papers.id))
    .where(and(eq(questionSources.questionId, questionId), eq(papers.paperType, "BOARD_EXAM"), eq(papers.isDemo, q.isDemo)));
  await db.update(questions).set({ frequencyCount: Number(n) }).where(eq(questions.id, questionId));
}
