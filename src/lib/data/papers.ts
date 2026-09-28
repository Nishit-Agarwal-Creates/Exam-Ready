import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, getEnv, schema } from "@/db";
import { DIFFICULTIES, PAPER_MODES, QUESTION_TYPES, type PaperMode, type SourceType } from "@/db/schema";
import {
  describeFilters,
  emptyComposition,
  estimatePaper,
  filterPool,
  generatePaper,
  type Composition,
  type GenerateFailure,
  type PoolFilters,
  type PoolQuestion,
  type Stage,
} from "@/lib/engine/generator";
import { isRealVerifiedPyq } from "@/lib/provenance";
import { coverageOf } from "@/lib/engine/coverage";
export type { YearCoverage } from "@/lib/engine/coverage";
import { safeJson, randomId } from "@/lib/text";
import { getPool, getQuestionViews, type QuestionView } from "./questions";

const { generatedPapers, paperQuestions, subjects, classes, boards, chapters } = schema;

export const paperRequestSchema = z.object({
  subjectId: z.coerce.number().int().positive(),
  chapterIds: z.array(z.coerce.number().int().positive()).max(60).default([]),
  totalMarks: z.coerce.number().int().min(5, "Choose at least 5 marks.").max(100, "Papers can be at most 100 marks."),
  durationMinutes: z.coerce.number().int().min(5, "Allow at least 5 minutes.").max(240, "Papers can be at most 4 hours."),
  difficulty: z.enum(["MIXED", ...DIFFICULTIES]).default("MIXED"),
  mode: z.enum(PAPER_MODES),
  allowSupplement: z.coerce.boolean().default(false),
  /** Empty = every type. */
  questionTypes: z.array(z.enum(QUESTION_TYPES)).max(QUESTION_TYPES.length).default([]),
  yearFrom: z.coerce.number().int().min(1990).max(2100).optional(),
  yearTo: z.coerce.number().int().min(1990).max(2100).optional(),
  excludeFigures: z.coerce.boolean().default(false),
});
export type PaperRequest = z.infer<typeof paperRequestSchema>;

const TYPE_LABELS: Record<string, string> = {
  MCQ: "multiple choice",
  ASSERTION_REASON: "assertion–reason",
  FILL_BLANK: "fill in the blank",
  NUMERICAL: "numerical",
  SHORT_ANSWER: "short answer",
  LONG_ANSWER: "long answer",
  CASE_BASED: "case-based",
};

function filtersOf(req: PaperRequest): PoolFilters {
  const [a, b] = [req.yearFrom, req.yearTo];
  return { types: req.questionTypes, yearFrom: a && b ? Math.min(a, b) : a, yearTo: a && b ? Math.max(a, b) : b, excludeFigures: req.excludeFigures };
}

export async function includeDemoData(): Promise<boolean> {
  const env = await getEnv();
  return (env.SHOW_DEMO_DATA ?? "true") !== "false";
}

async function subjectContext(subjectId: number) {
  const db = await getDb();
  const [row] = await db
    .select({
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectSlug: subjects.slug,
      classId: classes.id,
      classLevel: classes.level,
      classSlug: classes.slug,
      className: classes.name,
      boardId: boards.id,
      boardName: boards.name,
      boardSlug: boards.slug,
    })
    .from(subjects)
    .innerJoin(classes, eq(subjects.classId, classes.id))
    .innerJoin(boards, eq(classes.boardId, boards.id))
    .where(eq(subjects.id, subjectId));
  return row ?? null;
}

async function validChapterIds(subjectId: number, ids: number[]): Promise<number[]> {
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db.select({ id: chapters.id, subjectId: chapters.subjectId }).from(chapters).where(inArray(chapters.id, ids));
  return rows.filter((r) => r.subjectId === subjectId).map((r) => r.id);
}

export async function estimate(req: PaperRequest) {
  const chapterIds = await validChapterIds(req.subjectId, req.chapterIds);
  const includeDemo = await includeDemoData();
  const pool = filterPool(await getPool(req.subjectId, chapterIds, includeDemo), filtersOf(req));
  const est = estimatePaper(pool, { mode: req.mode, totalMarks: req.totalMarks, difficulty: req.difficulty, allowSupplement: req.allowSupplement });
  return { ...est, poolHasDemo: pool.some((p) => p.isDemo && p.isPublished), coverage: coverageOf(pool) };
}

export type CreatePaperResult = { ok: true; id: string; stages: Stage[] } | { ok: false; failure: GenerateFailure } | { ok: false; error: string };

export async function createPaper(req: PaperRequest): Promise<CreatePaperResult> {
  const ctx = await subjectContext(req.subjectId);
  if (!ctx) return { ok: false, error: "That subject doesn't exist." };
  const chapterIds = await validChapterIds(req.subjectId, req.chapterIds);
  const includeDemo = await includeDemoData();
  const filters = filtersOf(req);
  const pool = filterPool(await getPool(req.subjectId, chapterIds, includeDemo), filters);
  const seed = Math.floor(Math.random() * 2 ** 31);
  const result = generatePaper(pool, { mode: req.mode, totalMarks: req.totalMarks, difficulty: req.difficulty, seed, allowSupplement: req.allowSupplement });
  if (!result.ok) return { ok: false, failure: result };

  const db = await getDb();
  const chapterNames = chapterIds.length
    ? (await db.select({ name: chapters.name }).from(chapters).where(inArray(chapters.id, chapterIds)).orderBy(asc(chapters.sortOrder))).map(
        (c) => c.name,
      )
    : [];
  const scope = chapterNames.length === 0 ? "Full syllabus" : chapterNames.length <= 2 ? chapterNames.join(" and ") : `${chapterNames.length} chapters`;
  const id = randomId();
  const poolById = new Map(pool.map((p) => [p.id, p]));
  const hasDemo = result.selected.some((s) => poolById.get(s.questionId)?.isDemo);

  const insertPaper = db.insert(generatedPapers).values({
    id,
    boardId: ctx.boardId,
    classId: ctx.classId,
    subjectId: ctx.subjectId,
    title: `${ctx.subjectName}: ${scope}`,
    mode: req.mode,
    totalMarks: result.totalMarks,
    requestedMarks: req.totalMarks,
    durationMinutes: req.durationMinutes,
    difficulty: req.difficulty,
    chapterIds: JSON.stringify(chapterIds),
    composition: JSON.stringify(result.composition),
    notices: JSON.stringify([describeFilters(filters, TYPE_LABELS), ...result.notices].filter(Boolean)),
    hasDemo,
    seed,
  });
  const rows = result.selected.map((s, i) => ({ generatedPaperId: id, questionId: s.questionId, position: i + 1, section: s.section, marks: s.marks }));
  // 5 columns per row → 18 rows per statement keeps us under D1's 100-parameter limit.
  const inserts = [];
  for (let i = 0; i < rows.length; i += 18) inserts.push(db.insert(paperQuestions).values(rows.slice(i, i + 18)));
  await db.batch([insertPaper, ...inserts]);
  return { ok: true, id, stages: result.stages };
}

export type PaperView = {
  id: string;
  title: string;
  mode: PaperMode;
  totalMarks: number;
  durationMinutes: number;
  difficulty: string;
  createdAt: string;
  hasDemo: boolean;
  composition: Composition;
  notices: string[];
  chapterNames: string[];
  board: { name: string; slug: string };
  cls: { name: string; slug: string; level: number };
  subject: { id: number; name: string; slug: string };
  items: { position: number; section: string; marks: number; question: QuestionView }[];
};

export async function getPaper(id: string, withAnswers: boolean): Promise<PaperView | null> {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) return null;
  const db = await getDb();
  const [p] = await db.select().from(generatedPapers).where(eq(generatedPapers.id, id));
  if (!p) return null;
  const ctx = await subjectContext(p.subjectId);
  if (!ctx) return null;
  const pq = await db.select().from(paperQuestions).where(eq(paperQuestions.generatedPaperId, id)).orderBy(asc(paperQuestions.position));
  const views = await getQuestionViews(
    pq.map((r) => r.questionId),
    withAnswers,
  );
  const chapterIds = safeJson<number[]>(p.chapterIds, []);
  const chapterNames = chapterIds.length
    ? (await db.select({ name: chapters.name }).from(chapters).where(inArray(chapters.id, chapterIds)).orderBy(asc(chapters.sortOrder))).map(
        (c) => c.name,
      )
    : [];
  return {
    id: p.id,
    title: p.title,
    mode: p.mode,
    totalMarks: p.totalMarks,
    durationMinutes: p.durationMinutes,
    difficulty: p.difficulty,
    createdAt: p.createdAt,
    hasDemo: p.hasDemo,
    // Recomputed from each question's current provenance, so a paper never shows a stale label.
    composition: liveComposition(pq.map((r) => ({ marks: r.marks, q: views.get(r.questionId) })), p.composition),
    notices: safeJson<string[]>(p.notices, []),
    chapterNames,
    board: { name: ctx.boardName, slug: ctx.boardSlug },
    cls: { name: ctx.className, slug: ctx.classSlug, level: ctx.classLevel },
    subject: { id: ctx.subjectId, name: ctx.subjectName, slug: ctx.subjectSlug },
    items: pq
      .filter((r) => views.has(r.questionId))
      .map((r) => ({ position: r.position, section: r.section, marks: r.marks, question: views.get(r.questionId)! })),
  };
}

export async function listRecentPapers(limit = 50) {
  const db = await getDb();
  return db
    .select({
      id: generatedPapers.id,
      title: generatedPapers.title,
      mode: generatedPapers.mode,
      totalMarks: generatedPapers.totalMarks,
      createdAt: generatedPapers.createdAt,
      hasDemo: generatedPapers.hasDemo,
      className: classes.name,
      attempts: sql<number>`(select count(*) from attempts a where a.generated_paper_id = ${generatedPapers.id})`,
    })
    .from(generatedPapers)
    .innerJoin(classes, eq(generatedPapers.classId, classes.id))
    .orderBy(desc(generatedPapers.createdAt))
    .limit(limit);
}

function liveComposition(rows: { marks: number; q: QuestionView | undefined }[], stored: string): Composition {
  if (!rows.some((r) => r.q)) return { ...emptyComposition(), ...safeJson<Partial<Composition>>(stored, {}) };
  const c = emptyComposition();
  for (const { marks, q } of rows) {
    if (!q) continue;
    const key: SourceType = isRealVerifiedPyq(q) ? "VERIFIED_PYQ" : q.sourceType === "VERIFIED_PYQ" ? "PENDING_REVIEW" : q.sourceType;
    c[key].count++;
    c[key].marks += marks;
  }
  return c;
}
