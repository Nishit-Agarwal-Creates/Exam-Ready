import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AnswerSource, Confidence, Difficulty, MappingStatus, QuestionType, SourceType, VerificationStatus } from "@/db/schema";
import type { PoolQuestion } from "@/lib/engine/generator";
import type { AnswerKey } from "@/lib/engine/grading";
import type { SourceLink } from "@/lib/provenance";
import { safeJson } from "@/lib/text";

const { questions, questionSources, papers, chapters, topics, boards } = schema;

/** D1 allows at most 100 bound parameters per statement. */
export function chunk<T>(arr: T[], size = 90): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Outer-row references inside correlated subqueries must be table-qualified (drizzle renders bare names).
const QID = sql.raw(`"questions"."id"`);
const QCANON = sql.raw(`"questions"."canonical_question_id"`);

/** SQL: 1 when a question passes the verified-PYQ rule (see isRealVerifiedPyq). */
export const realPyqSql = sql<number>`(CASE WHEN ${questions.sourceType} = 'VERIFIED_PYQ' AND ${questions.verificationStatus} = 'VERIFIED' AND ${questions.isDemo} = 0 AND EXISTS (SELECT 1 FROM question_sources qs JOIN papers p ON p.id = qs.paper_id WHERE qs.question_id = ${QID} AND p.paper_type = 'BOARD_EXAM' AND p.is_demo = 0 AND p.year IS NOT NULL) THEN 1 ELSE 0 END)`;

/** SQL: most recent verified board-exam year linked to the question. */
const latestYearSql = sql<number | null>`(SELECT MAX(p.year) FROM question_sources qs JOIN papers p ON p.id = qs.paper_id WHERE qs.question_id = ${QID} AND p.paper_type = 'BOARD_EXAM' AND p.is_demo = 0)`;

/** SQL: distinct verified exam years across the question's duplicate group. */
const groupYearsSql = sql<number>`(SELECT COUNT(DISTINCT p.year) FROM questions q2 JOIN question_sources qs ON qs.question_id = q2.id JOIN papers p ON p.id = qs.paper_id WHERE COALESCE(q2.canonical_question_id, q2.id) = COALESCE(${QCANON}, ${QID}) AND q2.verification_status = 'VERIFIED' AND q2.is_demo = 0 AND p.paper_type = 'BOARD_EXAM' AND p.is_demo = 0 AND p.year IS NOT NULL)`;

export async function getPool(subjectId: number, chapterIds: number[], includeDemo: boolean): Promise<PoolQuestion[]> {
  const db = await getDb();
  const conds: SQL[] = [eq(questions.subjectId, subjectId)];
  if (chapterIds.length) conds.push(inArray(questions.chapterId, chapterIds));
  if (!includeDemo) conds.push(eq(questions.isDemo, false));
  const rows = await db
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
      isRealPyq: realPyqSql,
      year: latestYearSql,
      canonical: questions.canonicalQuestionId,
      groupYears: groupYearsSql,
      hasFigure: questions.hasFigure,
    })
    .from(questions)
    .where(and(...conds));
  return rows.map((r) => ({
    id: r.id,
    chapterId: r.chapterId,
    topicId: r.topicId,
    questionType: r.questionType,
    marks: r.marks,
    difficulty: r.difficulty as PoolQuestion["difficulty"],
    sourceType: r.sourceType,
    verificationStatus: r.verificationStatus,
    isPublished: r.isPublished,
    isDemo: r.isDemo,
    isRealPyq: Number(r.isRealPyq) === 1,
    year: r.year === null ? null : Number(r.year),
    groupId: r.canonical ?? r.id,
    groupYears: Number(r.groupYears ?? 0),
    hasFigure: Boolean(r.hasFigure),
  }));
}

export type QuestionView = {
  id: number;
  text: string;
  type: QuestionType;
  marks: number;
  difficulty: Difficulty | "UNRATED";
  options: string[] | null;
  chapter: { id: number; name: string; slug: string };
  topic: { id: number; name: string } | null;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  isPublished: boolean;
  frequencyCount: number;
  sources: SourceLink[];
  /** Sources of every question in the duplicate group (for frequency). */
  groupSources: SourceLink[];
  canonicalId: number | null;
  mappingStatus: MappingStatus;
  answerSource: AnswerSource;
  hasFigure: boolean;
  extractionConfidence: Confidence | null;
  extractionIssues: string[];
  /** Only present when answers are requested (never during an exam). */
  answer?: { text: string; explanation: string; key: AnswerKey };
};

export async function getSourcesFor(ids: number[]): Promise<Map<number, SourceLink[]>> {
  const db = await getDb();
  const map = new Map<number, SourceLink[]>();
  for (const part of chunk([...new Set(ids)])) {
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
        part: questionSources.part,
        pageNumber: questionSources.pageNumber,
        isDemo: papers.isDemo,
        isPrimary: questionSources.isPrimary,
        paperCode: papers.paperCode,
        setCode: papers.setCode,
        authority: papers.authority,
        authorityName: papers.authorityName,
        sourceFile: papers.sourceFile,
        boardName: boards.name,
      })
      .from(questionSources)
      .innerJoin(papers, eq(questionSources.paperId, papers.id))
      .innerJoin(boards, eq(papers.boardId, boards.id))
      .where(inArray(questionSources.questionId, part))
      .orderBy(desc(questionSources.isPrimary), desc(papers.year));
    for (const r of rows) {
      const { questionId, isPrimary: _p, ...link } = r;
      void _p;
      map.set(questionId, [...(map.get(questionId) ?? []), link]);
    }
  }
  return map;
}

/** Sources for whole duplicate groups, keyed by canonical id. */
async function getGroupSources(groupIds: number[]): Promise<Map<number, SourceLink[]>> {
  const db = await getDb();
  const out = new Map<number, SourceLink[]>();
  const ids = [...new Set(groupIds)];
  const members = new Map<number, number>(); // question id → group id
  for (const part of chunk(ids)) {
    if (!part.length) continue;
    const rows = await db
      .select({ id: questions.id, group: sql<number>`COALESCE(${questions.canonicalQuestionId}, ${questions.id})` })
      .from(questions)
      // Frequency must be backed by verified appearances only: unreviewed copies don't count.
      .where(and(or(inArray(questions.id, part), inArray(questions.canonicalQuestionId, part)), eq(questions.verificationStatus, "VERIFIED"), eq(questions.isDemo, false)));
    for (const r of rows) members.set(r.id, Number(r.group));
  }
  const sources = await getSourcesFor([...members.keys()]);
  for (const [qid, gid] of members) {
    const list = out.get(gid) ?? [];
    for (const s of sources.get(qid) ?? []) if (!list.some((x) => x.paperId === s.paperId)) list.push(s);
    out.set(gid, list);
  }
  return out;
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
  canonicalId: questions.canonicalQuestionId,
  mappingStatus: questions.mappingStatus,
  answerSource: questions.answerSource,
  hasFigure: questions.hasFigure,
  extractionConfidence: questions.extractionConfidence,
  extractionIssues: questions.extractionIssues,
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
  difficulty: Difficulty | "UNRATED";
  options: string | null;
  answerKey: string | null;
  answerText: string;
  explanation: string;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  isPublished: boolean;
  frequencyCount: number;
  canonicalId: number | null;
  mappingStatus: MappingStatus;
  answerSource: AnswerSource;
  hasFigure: boolean;
  extractionConfidence: Confidence | null;
  extractionIssues: string;
  chapterId: number;
  chapterName: string;
  chapterSlug: string;
  topicId: number | null;
  topicName: string | null;
};

function toView(r: ViewRow, sources: SourceLink[], groupSources: SourceLink[], withAnswers: boolean): QuestionView {
  return {
    id: r.id,
    text: r.text,
    type: r.type,
    marks: r.marks,
    difficulty: r.difficulty as QuestionView["difficulty"],
    options: safeJson<string[] | null>(r.options, null),
    chapter: { id: r.chapterId, name: r.chapterName, slug: r.chapterSlug },
    topic: r.topicId && r.topicName ? { id: r.topicId, name: r.topicName } : null,
    sourceType: r.sourceType,
    verificationStatus: r.verificationStatus,
    isDemo: r.isDemo,
    isPublished: r.isPublished,
    frequencyCount: r.frequencyCount,
    sources,
    groupSources: groupSources.length ? groupSources : sources,
    canonicalId: r.canonicalId,
    mappingStatus: r.mappingStatus,
    answerSource: r.answerSource,
    hasFigure: r.hasFigure,
    extractionConfidence: r.extractionConfidence,
    extractionIssues: safeJson<string[]>(r.extractionIssues, []),
    ...(withAnswers ? { answer: { text: r.answerText, explanation: r.explanation, key: safeJson<AnswerKey>(r.answerKey, null) } } : {}),
  };
}

/** `light` skips the duplicate-group lookup; `groupSources` then falls back to the question's own sources. */
async function hydrate(rows: ViewRow[], withAnswers: boolean, light = false): Promise<QuestionView[]> {
  const ids = rows.map((r) => r.id);
  const [sources, groups] = await Promise.all([
    getSourcesFor(ids),
    light ? new Map<number, SourceLink[]>() : getGroupSources(rows.map((r) => r.canonicalId ?? r.id)),
  ]);
  return rows.map((r) => toView(r, sources.get(r.id) ?? [], groups.get(r.canonicalId ?? r.id) ?? [], withAnswers));
}

export async function getQuestionViews(ids: number[], withAnswers: boolean): Promise<Map<number, QuestionView>> {
  const db = await getDb();
  const rows: ViewRow[] = [];
  for (const part of chunk(ids)) {
    if (!part.length) continue;
    rows.push(
      ...(await db
        .select(viewColumns)
        .from(questions)
        .innerJoin(chapters, eq(questions.chapterId, chapters.id))
        .leftJoin(topics, eq(questions.topicId, topics.id))
        .where(inArray(questions.id, part))),
    );
  }
  const views = await hydrate(rows, withAnswers);
  return new Map(views.map((v) => [v.id, v]));
}

export type QuestionFilters = {
  boardId?: number;
  classId?: number;
  /** Class level across boards (e.g. every "Class 10"). */
  classLevel?: number;
  subjectId?: number;
  /** Any of these subjects (e.g. "physics" in every class). */
  subjectIds?: number[];
  chapterId?: number;
  sourceType?: SourceType;
  status?: VerificationStatus;
  type?: QuestionType;
  difficulty?: Difficulty;
  marks?: number;
  year?: number;
  paperId?: number;
  /** Q.P. code printed on a linked source paper, e.g. "31/2/1". */
  paperCode?: string;
  /** Question number in a linked source paper, e.g. "34". */
  questionNumber?: string;
  q?: string;
  demo?: "only" | "exclude";
  /** Only questions that pass the verified-PYQ rule. */
  realPyqOnly?: boolean;
  /** Only verified PYQs whose duplicate group spans 2+ exam years. */
  repeatedOnly?: boolean;
  /** One question per duplicate group: the canonical one, or a duplicate whose canonical isn't published. */
  groupOnce?: boolean;
  /** Public browsing only shows published, reviewed questions. */
  publicOnly?: boolean;
  /** Editor queues. */
  issues?: "figure" | "low" | "any";
  published?: boolean;
  /** "paper" orders by question number within f.paperId (source pages). */
  sort?: "recent" | "chapter" | "paper";
  page?: number;
  pageSize?: number;
};

function filterConditions(f: QuestionFilters): SQL[] {
  const conds: SQL[] = [];
  if (f.boardId) conds.push(eq(questions.boardId, f.boardId));
  if (f.classId) conds.push(eq(questions.classId, f.classId));
  if (f.subjectId) conds.push(eq(questions.subjectId, f.subjectId));
  if (f.subjectIds?.length) conds.push(inArray(questions.subjectId, f.subjectIds.slice(0, 50)));
  if (f.classLevel) conds.push(sql`${questions.classId} IN (SELECT id FROM classes WHERE level = ${f.classLevel})`);
  if (f.chapterId) conds.push(eq(questions.chapterId, f.chapterId));
  if (f.sourceType) conds.push(eq(questions.sourceType, f.sourceType));
  if (f.status) conds.push(eq(questions.verificationStatus, f.status));
  if (f.type) conds.push(eq(questions.questionType, f.type));
  if (f.difficulty) conds.push(eq(questions.difficulty, f.difficulty));
  if (f.marks) conds.push(eq(questions.marks, f.marks));
  if (f.demo === "only") conds.push(eq(questions.isDemo, true));
  if (f.demo === "exclude") conds.push(eq(questions.isDemo, false));
  if (f.published !== undefined) conds.push(eq(questions.isPublished, f.published));
  if (f.publicOnly) {
    // Published, and either a real verified PYQ / reviewed question, or published AI practice.
    conds.push(eq(questions.isPublished, true), sql`${questions.verificationStatus} <> 'REJECTED'`);
    conds.push(sql`(${questions.verificationStatus} = 'VERIFIED' OR ${questions.sourceType} = 'AI_SUPPLEMENTARY')`);
  }
  if (f.realPyqOnly) conds.push(sql`${realPyqSql} = 1`);
  if (f.repeatedOnly) conds.push(sql`${realPyqSql} = 1 AND ${groupYearsSql} >= 2`);
  if (f.groupOnce)
    conds.push(
      sql`(${QCANON} IS NULL OR NOT EXISTS (SELECT 1 FROM questions c WHERE c.id = ${QCANON} AND c.is_published = 1 AND c.verification_status = 'VERIFIED'))`,
    );
  // "Appeared in year X": the question itself or any question in its duplicate group was in a paper of that year.
  if (f.year)
    conds.push(
      sql`EXISTS (SELECT 1 FROM questions q2 JOIN question_sources qs ON qs.question_id = q2.id JOIN papers p ON p.id = qs.paper_id WHERE COALESCE(q2.canonical_question_id, q2.id) = COALESCE(${QCANON}, ${QID}) AND p.year = ${f.year} AND p.is_demo = 0)`,
    );
  if (f.paperId) conds.push(sql`EXISTS (SELECT 1 FROM question_sources qs WHERE qs.question_id = ${QID} AND qs.paper_id = ${f.paperId})`);
  if (f.paperCode || f.questionNumber) {
    const code = f.paperCode ? sql` AND p.paper_code = ${f.paperCode}` : sql``;
    const num = f.questionNumber ? sql` AND qs.question_number = ${f.questionNumber}` : sql``;
    conds.push(sql`EXISTS (SELECT 1 FROM question_sources qs JOIN papers p ON p.id = qs.paper_id WHERE qs.question_id = ${QID}${code}${num})`);
  }
  if (f.issues === "figure") conds.push(eq(questions.hasFigure, true));
  if (f.issues === "low") conds.push(eq(questions.extractionConfidence, "LOW"));
  if (f.issues === "any") conds.push(sql`(${questions.hasFigure} = 1 OR ${questions.extractionConfidence} IN ('LOW','MEDIUM'))`);
  if (f.q && f.q.trim()) {
    // Every word must appear (in any order), so "refraction light" finds "refraction of light".
    const terms = f.q.trim().replace(/[%_]/g, "").slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 8);
    for (const t of terms) conds.push(or(like(questions.questionText, `%${t}%`), like(questions.externalKey, `%${t}%`))!);
  }
  return conds;
}

/**
 * `opts.light` is for editor lists that never show group-wide provenance or frequency (e.g. the review
 * queue): it saves a query and the group mapping per request.
 */
export async function searchQuestions(f: QuestionFilters, withAnswers: boolean, opts: { light?: boolean } = {}) {
  const db = await getDb();
  const conds = filterConditions(f);
  const where = conds.length ? and(...conds) : undefined;
  const pageSize = Math.min(Math.max(f.pageSize ?? 20, 1), 100);
  const page = Math.max(f.page ?? 1, 1);
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(questions).where(where);
  const paperOrder = f.paperId
    ? sql`(SELECT CAST(qs.question_number AS INTEGER) FROM question_sources qs WHERE qs.question_id = ${QID} AND qs.paper_id = ${f.paperId})`
    : null;
  const order =
    f.sort === "paper" && paperOrder
      ? [asc(paperOrder), asc(questions.id)]
      : f.sort === "recent"
        ? [desc(latestYearSql), asc(questions.id)]
        : [asc(chapters.sortOrder), asc(questions.marks), asc(questions.id)];
  const rows = await db
    .select(viewColumns)
    .from(questions)
    .innerJoin(chapters, eq(questions.chapterId, chapters.id))
    .leftJoin(topics, eq(questions.topicId, topics.id))
    .where(where)
    .orderBy(...order)
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return {
    total: Number(n),
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(Number(n) / pageSize)),
    items: await hydrate(rows, withAnswers, opts.light),
  };
}

/** Recomputes the cached frequency count (distinct board papers linked to this question). */
export async function refreshFrequency(questionId: number): Promise<void> {
  const db = await getDb();
  const [q] = await db.select({ isDemo: questions.isDemo }).from(questions).where(eq(questions.id, questionId));
  if (!q) return;
  const [{ n }] = await db
    .select({ n: sql<number>`count(distinct ${papers.id})` })
    .from(questionSources)
    .innerJoin(papers, eq(questionSources.paperId, papers.id))
    .where(and(eq(questionSources.questionId, questionId), eq(papers.paperType, "BOARD_EXAM"), eq(papers.isDemo, false)));
  await db.update(questions).set({ frequencyCount: q.isDemo ? 0 : Number(n) }).where(eq(questions.id, questionId));
}
