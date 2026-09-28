import { and, asc, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb, schema } from "@/db";
import { AGGREGATE_TTL, mapCodec, sharedCache } from "@/lib/data/shared-cache";
import type { SourceType } from "@/db/schema";
import { safeJson } from "@/lib/text";

const { boards, classes, subjects, chapters, topics, questions } = schema;

export type CatalogChapter = { id: number; slug: string; name: string };
export type CatalogSubject = { id: number; slug: string; name: string; chapters: CatalogChapter[] };
export type CatalogClass = { id: number; level: number; slug: string; name: string; subjects: CatalogSubject[] };
export type CatalogBoard = { id: number; slug: string; name: string; fullName: string; classes: CatalogClass[] };

/** The full board → class → subject → chapter tree used by the paper generator and navigation. */
const computeCatalog = async (): Promise<CatalogBoard[]> => {
  const db = await getDb();
  const [b, c, s, ch] = await Promise.all([
    db.select().from(boards).where(eq(boards.isActive, true)).orderBy(asc(boards.sortOrder)),
    db.select().from(classes).where(eq(classes.isActive, true)).orderBy(asc(classes.level)),
    db.select({ id: subjects.id, classId: subjects.classId, slug: subjects.slug, name: subjects.name }).from(subjects).orderBy(asc(subjects.sortOrder)),
    db.select({ id: chapters.id, subjectId: chapters.subjectId, slug: chapters.slug, name: chapters.name }).from(chapters).orderBy(asc(chapters.sortOrder)),
  ]);
  return b.map((board) => ({
    id: board.id,
    slug: board.slug,
    name: board.name,
    fullName: board.fullName,
    classes: c
      .filter((cl) => cl.boardId === board.id)
      .map((cl) => ({
        id: cl.id,
        level: cl.level,
        slug: cl.slug,
        name: cl.name,
        subjects: s
          .filter((su) => su.classId === cl.id)
          .map((su) => ({
            id: su.id,
            slug: su.slug,
            name: su.name,
            chapters: ch.filter((x) => x.subjectId === su.id).map(({ id, slug, name }) => ({ id, slug, name })),
          })),
      })),
  }));
};
export const getCatalog = cache(() => sharedCache("taxonomy:catalog", AGGREGATE_TTL, () => computeCatalog()));

export const getBoard = cache(async (slug: string) => {
  const db = await getDb();
  const [row] = await db.select().from(boards).where(and(eq(boards.slug, slug), eq(boards.isActive, true))).limit(1);
  return row ?? null;
});

export const getClass = cache(async (boardSlug: string, classSlug: string) => {
  const board = await getBoard(boardSlug);
  if (!board) return null;
  const db = await getDb();
  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.boardId, board.id), eq(classes.slug, classSlug), eq(classes.isActive, true)))
    .limit(1);
  return cls ? { board, cls } : null;
});

export type ChapterWithTopics = typeof chapters.$inferSelect & { topics: (typeof topics.$inferSelect)[] };

export const getSubject = cache(async (boardSlug: string, classSlug: string, subjectSlug: string) => {
  const ctx = await getClass(boardSlug, classSlug);
  if (!ctx) return null;
  const db = await getDb();
  const [subject] = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.classId, ctx.cls.id), eq(subjects.slug, subjectSlug)))
    .limit(1);
  if (!subject) return null;
  const chs = await db.select().from(chapters).where(eq(chapters.subjectId, subject.id)).orderBy(asc(chapters.sortOrder));
  const tps = await db
    .select({ topic: topics })
    .from(topics)
    .innerJoin(chapters, eq(topics.chapterId, chapters.id))
    .where(eq(chapters.subjectId, subject.id))
    .orderBy(asc(topics.sortOrder));
  const chaptersWithTopics: ChapterWithTopics[] = chs.map((c) => ({ ...c, topics: tps.filter((t) => t.topic.chapterId === c.id).map((t) => t.topic) }));
  return {
    ...ctx,
    subject: { ...subject, studyTips: safeJson<string[]>(subject.studyTips, []) },
    chapters: chaptersWithTopics,
  };
});

export type ChapterStats = {
  chapterId: number;
  total: number;
  marks: number;
  bySource: Record<SourceType, number>;
  demo: number;
  realVerifiedPyq: number;
};

/** Per-chapter counts of published, reviewed questions. Used on SEO pages and the generator. */
async function computeSubjectStats(subjectId: number): Promise<Map<number, ChapterStats>> {
  const db = await getDb();
  const rows = await db
    .select({
      chapterId: questions.chapterId,
      sourceType: questions.sourceType,
      isDemo: questions.isDemo,
      n: sql<number>`count(*)`,
      marks: sql<number>`sum(${questions.marks})`,
    })
    .from(questions)
    // Published practice material: reviewed questions plus published AI practice (always labelled). Rejected never counts.
    .where(
      and(
        eq(questions.subjectId, subjectId),
        eq(questions.isPublished, true),
        sql`${questions.verificationStatus} <> 'REJECTED'`,
        sql`(${questions.verificationStatus} = 'VERIFIED' OR ${questions.sourceType} = 'AI_SUPPLEMENTARY')`,
      ),
    )
    .groupBy(questions.chapterId, questions.sourceType, questions.isDemo);
  const map = new Map<number, ChapterStats>();
  for (const r of rows) {
    const s =
      map.get(r.chapterId) ??
      ({
        chapterId: r.chapterId,
        total: 0,
        marks: 0,
        bySource: { VERIFIED_PYQ: 0, OFFICIAL_SAMPLE: 0, USER_CONTRIBUTED: 0, AI_SUPPLEMENTARY: 0, PENDING_REVIEW: 0 },
        demo: 0,
        realVerifiedPyq: 0,
      } as ChapterStats);
    s.total += Number(r.n);
    s.marks += Number(r.marks);
    s.bySource[r.sourceType] += Number(r.n);
    if (r.isDemo) s.demo += Number(r.n);
    else if (r.sourceType === "VERIFIED_PYQ") s.realVerifiedPyq += Number(r.n);
    map.set(r.chapterId, s);
  }
  return map;
}

export function getSubjectStats(subjectId: number): Promise<Map<number, ChapterStats>> {
  return sharedCache(`taxonomy:stats:${subjectId}`, AGGREGATE_TTL, () => computeSubjectStats(subjectId), mapCodec<number, ChapterStats>());
}

export function sumStats(stats: Map<number, ChapterStats>) {
  let total = 0,
    demo = 0,
    realVerifiedPyq = 0,
    marks = 0;
  for (const s of stats.values()) {
    total += s.total;
    demo += s.demo;
    realVerifiedPyq += s.realVerifiedPyq;
    marks += s.marks;
  }
  return { total, demo, realVerifiedPyq, marks };
}

export async function getSubjectByIdForAdmin(subjectId: number) {
  const catalog = await getCatalog();
  for (const b of catalog)
    for (const c of b.classes)
      for (const s of c.subjects) if (s.id === subjectId) return { ...s, label: `${b.name} ${c.name} ${s.name}` };
  return null;
}
