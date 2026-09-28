/**
 * Evidence-based coverage and trend data. Every figure is computed from stored rows:
 *   - only real verified PYQs (non-demo, VERIFIED, linked to a board paper with a year) count as PYQs
 *   - duplicate groups count once; "repeated" means the group spans 2+ distinct exam years
 *   - AI practice, demo data and unreviewed extractions never enter PYQ statistics
 */
import { sql } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db";
import { coverageOf } from "@/lib/engine/coverage";
import { getPool } from "./questions";

export const getSubjectCoverage = cache(async (subjectId: number) => {
  const pool = await getPool(subjectId, [], false);
  const cov = coverageOf(pool);
  const aiPractice = pool.filter((q) => q.sourceType === "AI_SUPPLEMENTARY" && q.isPublished).length;
  return { ...cov, aiPractice };
});

export type SubjectTrends = {
  papers: number;
  years: number[];
  verifiedQuestions: number;
  chapters: { chapterId: number; name: string; slug: string; questions: number; marks: number; papers: number; years: number[] }[];
  types: { type: string; questions: number; marks: number }[];
  marksDistribution: { marks: number; questions: number }[];
  repeated: { groupId: number; text: string; years: number[] }[];
};

/** Trends over real verified PYQs only. Returns empty collections when there is no verified data. */
export const getSubjectTrends = cache(async (subjectId: number): Promise<SubjectTrends> => {
  const db = await getDb();
  // One row per (verified question, board paper appearance).
  const rows = await db.all<{ qid: number; gid: number; chapter_id: number; chapter: string; slug: string; type: string; marks: number; paper_id: number; year: number; text: string }>(sql`
    SELECT q.id AS qid, COALESCE(q.canonical_question_id, q.id) AS gid, q.chapter_id, ch.name AS chapter, ch.slug AS slug, q.question_type AS type, q.marks,
           p.id AS paper_id, p.year, q.question_text AS text
    FROM questions q
    JOIN chapters ch ON ch.id = q.chapter_id
    JOIN question_sources qs ON qs.question_id = q.id
    JOIN papers p ON p.id = qs.paper_id
    WHERE q.subject_id = ${subjectId} AND q.is_demo = 0 AND q.source_type = 'VERIFIED_PYQ' AND q.verification_status = 'VERIFIED' AND q.is_published = 1
      AND p.paper_type = 'BOARD_EXAM' AND p.is_demo = 0 AND p.year IS NOT NULL`);

  const groups = new Map<number, { text: string; chapterId: number; type: string; marks: number; years: Set<number>; papers: Set<number> }>();
  for (const r of rows) {
    const g = groups.get(r.gid) ?? { text: r.text, chapterId: r.chapter_id, type: r.type, marks: r.marks, years: new Set<number>(), papers: new Set<number>() };
    g.years.add(Number(r.year));
    g.papers.add(r.paper_id);
    groups.set(r.gid, g);
  }
  const chapterMeta = new Map(rows.map((r) => [r.chapter_id, { name: r.chapter, slug: r.slug }]));
  const chapters = new Map<number, { questions: number; marks: number; papers: Set<number>; years: Set<number> }>();
  const types = new Map<string, { questions: number; marks: number }>();
  const marks = new Map<number, number>();
  for (const g of groups.values()) {
    const c = chapters.get(g.chapterId) ?? { questions: 0, marks: 0, papers: new Set<number>(), years: new Set<number>() };
    c.questions++;
    c.marks += g.marks;
    g.papers.forEach((p) => c.papers.add(p));
    g.years.forEach((y) => c.years.add(y));
    chapters.set(g.chapterId, c);
    const t = types.get(g.type) ?? { questions: 0, marks: 0 };
    t.questions++;
    t.marks += g.marks;
    types.set(g.type, t);
    marks.set(g.marks, (marks.get(g.marks) ?? 0) + 1);
  }
  const allYears = [...new Set(rows.map((r) => Number(r.year)))].sort((a, b) => b - a);
  return {
    papers: new Set(rows.map((r) => r.paper_id)).size,
    years: allYears,
    verifiedQuestions: groups.size,
    chapters: [...chapters.entries()]
      .map(([chapterId, c]) => ({
        chapterId,
        name: chapterMeta.get(chapterId)!.name,
        slug: chapterMeta.get(chapterId)!.slug,
        questions: c.questions,
        marks: c.marks,
        papers: c.papers.size,
        years: [...c.years].sort((a, b) => b - a),
      }))
      .sort((a, b) => b.papers - a.papers || b.marks - a.marks),
    types: [...types.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.marks - a.marks),
    marksDistribution: [...marks.entries()].map(([m, n]) => ({ marks: m, questions: n })).sort((a, b) => a.marks - b.marks),
    repeated: [...groups.entries()]
      .filter(([, g]) => g.years.size >= 2)
      .map(([groupId, g]) => ({ groupId, text: g.text, years: [...g.years].sort((a, b) => b - a) }))
      .sort((a, b) => b.years.length - a.years.length),
  };
});

export type BoardCoverageRow = {
  boardSlug: string;
  boardName: string;
  classSlug: string;
  className: string;
  level: number;
  subjectId: number;
  subjectSlug: string;
  subjectName: string;
  verified: number;
  pending: number;
  aiPractice: number;
  years: number[];
  pendingYears: number[];
};

/** Availability for every subject, for the homepage and subject lists. */
export const getAllCoverage = cache(async (): Promise<BoardCoverageRow[]> => {
  const db = await getDb();
  const subjects = await db.all<{ board_slug: string; board_name: string; class_slug: string; class_name: string; level: number; subject_id: number; subject_slug: string; subject_name: string; ai: number }>(sql`
    SELECT b.slug AS board_slug, b.name AS board_name, c.slug AS class_slug, c.name AS class_name, c.level, s.id AS subject_id, s.slug AS subject_slug, s.name AS subject_name,
      (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id AND q.source_type = 'AI_SUPPLEMENTARY' AND q.is_published = 1) AS ai
    FROM subjects s JOIN classes c ON c.id = s.class_id JOIN boards b ON b.id = c.board_id
    WHERE b.is_active = 1 AND c.is_active = 1
    ORDER BY b.sort_order, c.level DESC, s.sort_order`);
  const years = await db.all<{ subject_id: number; year: number; verified: number; pending: number }>(sql`
    SELECT q.subject_id, p.year,
      COUNT(DISTINCT CASE WHEN q.verification_status = 'VERIFIED' AND q.is_published = 1 THEN COALESCE(q.canonical_question_id, q.id) END) AS verified,
      COUNT(DISTINCT CASE WHEN q.verification_status = 'UNVERIFIED' THEN COALESCE(q.canonical_question_id, q.id) END) AS pending
    FROM questions q JOIN question_sources qs ON qs.question_id = q.id JOIN papers p ON p.id = qs.paper_id
    WHERE q.is_demo = 0 AND q.source_type = 'VERIFIED_PYQ' AND p.paper_type = 'BOARD_EXAM' AND p.is_demo = 0 AND p.year IS NOT NULL
    GROUP BY q.subject_id, p.year`);
  const totals = await db.all<{ subject_id: number; verified: number; pending: number }>(sql`
    SELECT q.subject_id,
      COUNT(DISTINCT CASE WHEN q.verification_status = 'VERIFIED' AND q.is_published = 1 THEN COALESCE(q.canonical_question_id, q.id) END) AS verified,
      COUNT(DISTINCT CASE WHEN q.verification_status = 'UNVERIFIED' THEN COALESCE(q.canonical_question_id, q.id) END) AS pending
    FROM questions q
    WHERE q.is_demo = 0 AND q.source_type = 'VERIFIED_PYQ'
      AND EXISTS (SELECT 1 FROM question_sources qs JOIN papers p ON p.id = qs.paper_id WHERE qs.question_id = q.id AND p.paper_type = 'BOARD_EXAM' AND p.is_demo = 0 AND p.year IS NOT NULL)
    GROUP BY q.subject_id`);
  const tot = new Map(totals.map((t) => [t.subject_id, t]));
  return subjects.map((s) => {
    const ys = years.filter((y) => y.subject_id === s.subject_id);
    return {
      boardSlug: s.board_slug,
      boardName: s.board_name,
      classSlug: s.class_slug,
      className: s.class_name,
      level: Number(s.level),
      subjectId: s.subject_id,
      subjectSlug: s.subject_slug,
      subjectName: s.subject_name,
      verified: Number(tot.get(s.subject_id)?.verified ?? 0),
      pending: Number(tot.get(s.subject_id)?.pending ?? 0),
      aiPractice: Number(s.ai ?? 0),
      years: ys.filter((y) => Number(y.verified) > 0).map((y) => Number(y.year)).sort((a, b) => b - a),
      pendingYears: ys.filter((y) => Number(y.pending) > 0).map((y) => Number(y.year)).sort((a, b) => b - a),
    };
  });
});

/** Public list of source documents with their extraction and verification counts. */
export const getPublicSources = cache(async () => {
  const db = await getDb();
  const rows = await db.all<{
    id: number; title: string; year: number | null; paper_type: string; authority: string; authority_name: string | null; source_domain: string | null;
    source_url: string | null; paper_code: string | null; set_code: string | null; status: string; board: string; cls: string; subject: string;
    extracted: number; verified: number; created_at: string;
  }>(sql`
    SELECT p.id, p.title, p.year, p.paper_type, p.authority, p.authority_name, p.source_domain, p.source_url, p.paper_code, p.set_code, p.status, p.created_at,
      b.name AS board, c.name AS cls, s.name AS subject,
      (SELECT COUNT(*) FROM question_sources qs WHERE qs.paper_id = p.id) AS extracted,
      (SELECT COUNT(*) FROM question_sources qs JOIN questions q ON q.id = qs.question_id WHERE qs.paper_id = p.id AND q.verification_status = 'VERIFIED' AND q.is_published = 1) AS verified
    FROM papers p JOIN subjects s ON s.id = p.subject_id JOIN classes c ON c.id = p.class_id JOIN boards b ON b.id = p.board_id
    WHERE p.is_demo = 0 AND p.status <> 'REJECTED'
    ORDER BY p.year DESC, p.title`);
  return rows.map((r) => ({ ...r, extracted: Number(r.extracted), verified: Number(r.verified) }));
});
