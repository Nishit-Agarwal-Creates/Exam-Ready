/**
 * Coverage across the whole bank in a few grouped queries (no per-subject loops), for the coverage
 * dashboard, class pages, the homepage and the sitemap.
 *
 * Counting rules (same as src/lib/provenance.ts):
 *   - Verified PYQ: not demo, VERIFIED_PYQ, VERIFIED, published, linked to a board-exam paper with a
 *     year. Duplicate groups (canonical_question_id) count once.
 *   - Official sample: OFFICIAL_SAMPLE, VERIFIED and published. Duplicate groups count once.
 *   - AI practice: published AI_SUPPLEMENTARY (this includes the AI-written practice bank).
 *   - Awaiting review: official material (PYQ or sample) extracted but not yet verified.
 *   - Years: distinct exam years of the linked board papers of verified PYQs.
 */
import { sql } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db";

export type CoverageCounts = {
  verifiedPyq: number;
  officialSample: number;
  community: number;
  aiPractice: number;
  /** Official material (PYQs and samples) extracted but not yet verified. */
  awaitingReview: number;
  /** The board-exam (PYQ) part of awaitingReview. */
  awaitingPyq: number;
  years: number[];
  pendingYears: number[];
};
export type SubjectCoverage = CoverageCounts & {
  boardSlug: string;
  boardName: string;
  classId: number;
  classSlug: string;
  className: string;
  level: number;
  subjectId: number;
  subjectSlug: string;
  subjectName: string;
  chapterCount: number;
  sourcePapers: { boardExam: number; sample: number; other: number };
};
export type ChapterCoverage = CoverageCounts & { chapterId: number; slug: string; name: string; sortOrder: number };

const REAL_PYQ = sql.raw(
  `q.is_demo = 0 AND q.source_type = 'VERIFIED_PYQ' AND q.verification_status = 'VERIFIED' AND q.is_published = 1 AND EXISTS (SELECT 1 FROM question_sources s JOIN papers p ON p.id = s.paper_id WHERE s.question_id = q.id AND p.paper_type = 'BOARD_EXAM' AND p.is_demo = 0 AND p.year IS NOT NULL)`,
);
const GROUP = sql.raw("COALESCE(q.canonical_question_id, q.id)");

type CountRow = { subject_id: number; chapter_id: number; verified_pyq: number; official: number; community: number; ai: number; pending: number; pending_pyq: number };
type YearRow = { subject_id: number; chapter_id: number; year: number; kind: "v" | "p" };

const loadCounts = cache(async () => {
  const db = await getDb();
  const counts = await db.all<CountRow>(sql`
    SELECT q.subject_id, q.chapter_id,
      COUNT(DISTINCT CASE WHEN ${REAL_PYQ} THEN ${GROUP} END) AS verified_pyq,
      COUNT(DISTINCT CASE WHEN q.source_type = 'OFFICIAL_SAMPLE' AND q.verification_status = 'VERIFIED' AND q.is_published = 1 THEN ${GROUP} END) AS official,
      SUM(CASE WHEN q.source_type = 'USER_CONTRIBUTED' AND q.verification_status = 'VERIFIED' AND q.is_published = 1 THEN 1 ELSE 0 END) AS community,
      SUM(CASE WHEN q.source_type = 'AI_SUPPLEMENTARY' AND q.is_published = 1 AND q.verification_status <> 'REJECTED' THEN 1 ELSE 0 END) AS ai,
      COUNT(DISTINCT CASE WHEN q.is_demo = 0 AND q.verification_status = 'UNVERIFIED' AND q.source_type IN ('VERIFIED_PYQ', 'OFFICIAL_SAMPLE') THEN ${GROUP} END) AS pending,
      COUNT(DISTINCT CASE WHEN q.is_demo = 0 AND q.verification_status = 'UNVERIFIED' AND q.source_type = 'VERIFIED_PYQ' THEN ${GROUP} END) AS pending_pyq
    FROM questions q
    GROUP BY q.subject_id, q.chapter_id`);
  const years = await db.all<YearRow>(sql`
    SELECT q.subject_id, q.chapter_id, p.year,
      CASE WHEN q.verification_status = 'VERIFIED' AND q.is_published = 1 THEN 'v' ELSE 'p' END AS kind
    FROM questions q JOIN question_sources s ON s.question_id = q.id JOIN papers p ON p.id = s.paper_id
    WHERE q.is_demo = 0 AND q.source_type = 'VERIFIED_PYQ' AND q.verification_status <> 'REJECTED'
      AND p.paper_type = 'BOARD_EXAM' AND p.is_demo = 0 AND p.year IS NOT NULL
    GROUP BY q.subject_id, q.chapter_id, p.year, kind`);
  const papers = await db.all<{ subject_id: number; paper_type: string; n: number }>(sql`
    SELECT subject_id, paper_type, COUNT(*) AS n FROM papers WHERE is_demo = 0 AND status <> 'REJECTED' GROUP BY subject_id, paper_type`);
  return { counts, years, papers };
});

const empty = (): CoverageCounts => ({ verifiedPyq: 0, officialSample: 0, community: 0, aiPractice: 0, awaitingReview: 0, awaitingPyq: 0, years: [], pendingYears: [] });

function add(into: CoverageCounts, r: CountRow) {
  into.verifiedPyq += Number(r.verified_pyq ?? 0);
  into.officialSample += Number(r.official ?? 0);
  into.community += Number(r.community ?? 0);
  into.aiPractice += Number(r.ai ?? 0);
  into.awaitingReview += Number(r.pending ?? 0);
  into.awaitingPyq += Number(r.pending_pyq ?? 0);
}
const sortYears = (s: Set<number>) => [...s].sort((a, b) => b - a);

/** One row per subject in the catalogue, in board/class/subject order, including empty subjects. */
export const getSubjectCoverage = cache(async (): Promise<SubjectCoverage[]> => {
  const db = await getDb();
  const [subjects, { counts, years, papers }] = await Promise.all([
    db.all<{ board_slug: string; board_name: string; class_id: number; class_slug: string; class_name: string; level: number; subject_id: number; subject_slug: string; subject_name: string; chapters: number }>(sql`
      SELECT b.slug AS board_slug, b.name AS board_name, c.id AS class_id, c.slug AS class_slug, c.name AS class_name, c.level,
        s.id AS subject_id, s.slug AS subject_slug, s.name AS subject_name,
        (SELECT COUNT(*) FROM chapters ch WHERE ch.subject_id = s.id) AS chapters
      FROM subjects s JOIN classes c ON c.id = s.class_id JOIN boards b ON b.id = c.board_id
      WHERE b.is_active = 1 AND c.is_active = 1
      ORDER BY b.sort_order, c.level, s.sort_order, s.name`),
    loadCounts(),
  ]);
  const bySubject = new Map<number, { c: CoverageCounts; v: Set<number>; p: Set<number> }>();
  const get = (id: number) => {
    let e = bySubject.get(id);
    if (!e) bySubject.set(id, (e = { c: empty(), v: new Set(), p: new Set() }));
    return e;
  };
  for (const r of counts) add(get(r.subject_id).c, r);
  for (const y of years) (y.kind === "v" ? get(y.subject_id).v : get(y.subject_id).p).add(Number(y.year));
  const paperMap = new Map<number, { boardExam: number; sample: number; other: number }>();
  for (const p of papers) {
    const e = paperMap.get(p.subject_id) ?? { boardExam: 0, sample: 0, other: 0 };
    if (p.paper_type === "BOARD_EXAM") e.boardExam += Number(p.n);
    else if (p.paper_type === "SAMPLE" || p.paper_type === "SPECIMEN") e.sample += Number(p.n);
    else e.other += Number(p.n);
    paperMap.set(p.subject_id, e);
  }
  return subjects.map((s) => {
    const e = bySubject.get(s.subject_id);
    const v = e ? sortYears(e.v) : [];
    return {
      ...(e?.c ?? empty()),
      years: v,
      pendingYears: e ? sortYears(e.p).filter((y) => !v.includes(y)) : [],
      boardSlug: s.board_slug,
      boardName: s.board_name,
      classId: s.class_id,
      classSlug: s.class_slug,
      className: s.class_name,
      level: Number(s.level),
      subjectId: s.subject_id,
      subjectSlug: s.subject_slug,
      subjectName: s.subject_name,
      chapterCount: Number(s.chapters),
      sourcePapers: paperMap.get(s.subject_id) ?? { boardExam: 0, sample: 0, other: 0 },
    };
  });
});

/** Chapter rows for one subject, including chapters with nothing yet. */
export async function getChapterCoverage(subjectId: number): Promise<ChapterCoverage[]> {
  const db = await getDb();
  const [chapters, { counts, years }] = await Promise.all([
    db.all<{ id: number; slug: string; name: string; sort_order: number }>(sql`SELECT id, slug, name, sort_order FROM chapters WHERE subject_id = ${subjectId} ORDER BY sort_order, name`),
    loadCounts(),
  ]);
  return chapters.map((ch) => {
    const c = empty();
    for (const r of counts) if (r.subject_id === subjectId && r.chapter_id === ch.id) add(c, r);
    const v = new Set<number>();
    const p = new Set<number>();
    for (const y of years) if (y.subject_id === subjectId && y.chapter_id === ch.id) (y.kind === "v" ? v : p).add(Number(y.year));
    const vy = sortYears(v);
    return { ...c, years: vy, pendingYears: sortYears(p).filter((y) => !vy.includes(y)), chapterId: ch.id, slug: ch.slug, name: ch.name, sortOrder: Number(ch.sort_order) };
  });
}

/** Whole-bank totals, for honest headline numbers. */
export async function getBankTotals() {
  const rows = await getSubjectCoverage();
  const db = await getDb();
  const [{ n: sources }] = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM papers WHERE is_demo = 0 AND status <> 'REJECTED'`);
  return {
    verifiedPyq: rows.reduce((t, r) => t + r.verifiedPyq, 0),
    officialSample: rows.reduce((t, r) => t + r.officialSample, 0),
    aiPractice: rows.reduce((t, r) => t + r.aiPractice, 0),
    awaitingReview: rows.reduce((t, r) => t + r.awaitingReview, 0),
    awaitingPyq: rows.reduce((t, r) => t + r.awaitingPyq, 0),
    sources: Number(sources),
    subjectsWithVerified: rows.filter((r) => r.verifiedPyq + r.officialSample > 0).length,
  };
}

/** Published question counts per subject (anything a student can see), for noindex/sitemap decisions. */
export function publishedTotal(r: CoverageCounts) {
  return r.verifiedPyq + r.officialSample + r.community + r.aiPractice;
}

/** Published totals per chapter for every subject (one query), for the sitemap. */
export const getPublishedByChapter = cache(async () => {
  const db = await getDb();
  const [chapters, { counts }] = await Promise.all([db.all<{ id: number; subject_id: number; slug: string }>(sql`SELECT id, subject_id, slug FROM chapters`), loadCounts()]);
  const totals = new Map<number, number>();
  for (const r of counts) totals.set(r.chapter_id, (totals.get(r.chapter_id) ?? 0) + Number(r.verified_pyq) + Number(r.official) + Number(r.community) + Number(r.ai));
  const out = new Map<number, { slug: string; published: number }[]>();
  for (const ch of chapters) {
    const list = out.get(ch.subject_id) ?? [];
    list.push({ slug: ch.slug, published: totals.get(ch.id) ?? 0 });
    out.set(ch.subject_id, list);
  }
  return out;
});

/**
 * Verified and pending previous-year questions for one subject, by exam year, in one grouped query.
 * Same shape as engine/coverage.ts coverageOf(), without loading the whole question pool.
 */
export async function getSubjectYearCoverage(subjectId: number) {
  const db = await getDb();
  const rows = await db.all<{ year: number; verified: number; pending: number }>(sql`
    SELECT p.year,
      COUNT(DISTINCT CASE WHEN q.verification_status = 'VERIFIED' AND q.is_published = 1 THEN ${GROUP} END) AS verified,
      COUNT(DISTINCT CASE WHEN q.verification_status = 'UNVERIFIED' THEN ${GROUP} END) AS pending
    FROM questions q JOIN question_sources s ON s.question_id = q.id JOIN papers p ON p.id = s.paper_id
    WHERE q.subject_id = ${subjectId} AND q.is_demo = 0 AND q.source_type = 'VERIFIED_PYQ'
      AND p.paper_type = 'BOARD_EXAM' AND p.is_demo = 0 AND p.year IS NOT NULL
    GROUP BY p.year ORDER BY p.year DESC`);
  const [tot] = await db.all<{ verified: number; pending: number }>(sql`
    SELECT COUNT(DISTINCT CASE WHEN ${REAL_PYQ} THEN ${GROUP} END) AS verified,
      COUNT(DISTINCT CASE WHEN q.is_demo = 0 AND q.source_type = 'VERIFIED_PYQ' AND q.verification_status = 'UNVERIFIED' THEN ${GROUP} END) AS pending
    FROM questions q WHERE q.subject_id = ${subjectId}`);
  return {
    verifiedPyqs: Number(tot?.verified ?? 0),
    pendingPyqs: Number(tot?.pending ?? 0),
    byYear: rows.map((r) => ({ year: Number(r.year), verified: Number(r.verified), pending: Number(r.pending) })),
  };
}
