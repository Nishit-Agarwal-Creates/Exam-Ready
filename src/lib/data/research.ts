/**
 * Review workload per source document for the admin research centre, in one grouped query.
 * Issue categories come from the extraction_issues JSON text written by the importer/source packs.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export type SourceQueue = {
  paperId: number;
  title: string;
  board: string;
  cls: string;
  subject: string;
  year: number | null;
  paperType: string;
  status: string;
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  formulaLoss: number;
  figure: number;
  lowConfidence: number;
  noAnswer: number;
  answerPartial: number;
  suggestedMapping: number;
};

/** Pending questions whose extraction notes mention any of the given fragments (fixed strings, not user input). */
const ISSUE = (...patterns: string[]) =>
  sql.raw(`SUM(CASE WHEN q.verification_status = 'UNVERIFIED' AND (${patterns.map((p) => `LOWER(q.extraction_issues) LIKE '%${p}%'`).join(" OR ")}) THEN 1 ELSE 0 END)`);

export async function getSourceQueues(): Promise<SourceQueue[]> {
  const db = await getDb();
  const rows = await db.all<Record<string, number | string | null>>(sql`
    SELECT p.id AS paper_id, p.title, p.year, p.paper_type, p.status, b.name AS board, c.name AS cls, s.name AS subject,
      COUNT(q.id) AS total,
      SUM(CASE WHEN q.verification_status = 'UNVERIFIED' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN q.verification_status = 'VERIFIED' THEN 1 ELSE 0 END) AS verified,
      SUM(CASE WHEN q.verification_status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
      ${ISSUE("notation", "superscript", "subscript", "fraction", "symbol", "equation")} AS formula_loss,
      SUM(CASE WHEN q.verification_status = 'UNVERIFIED' AND q.has_figure = 1 THEN 1 ELSE 0 END) AS figure,
      SUM(CASE WHEN q.verification_status = 'UNVERIFIED' AND q.extraction_confidence = 'LOW' THEN 1 ELSE 0 END) AS low_conf,
      SUM(CASE WHEN q.verification_status = 'UNVERIFIED' AND q.answer_source = 'NONE' THEN 1 ELSE 0 END) AS no_answer,
      ${ISSUE("answer partly missing")} AS answer_partial,
      SUM(CASE WHEN q.verification_status = 'UNVERIFIED' AND q.mapping_status = 'SUGGESTED' THEN 1 ELSE 0 END) AS suggested
    FROM papers p
    JOIN boards b ON b.id = p.board_id JOIN classes c ON c.id = p.class_id JOIN subjects s ON s.id = p.subject_id
    LEFT JOIN question_sources qs ON qs.paper_id = p.id
    LEFT JOIN questions q ON q.id = qs.question_id
    WHERE p.is_demo = 0
    GROUP BY p.id
    ORDER BY pending DESC, p.year DESC, p.title`);
  const n = (v: unknown) => Number(v ?? 0);
  return rows.map((r) => ({
    paperId: n(r.paper_id),
    title: String(r.title),
    board: String(r.board),
    cls: String(r.cls),
    subject: String(r.subject),
    year: r.year === null ? null : n(r.year),
    paperType: String(r.paper_type),
    status: String(r.status),
    total: n(r.total),
    pending: n(r.pending),
    verified: n(r.verified),
    rejected: n(r.rejected),
    formulaLoss: Math.max(0, n(r.formula_loss)),
    figure: n(r.figure),
    lowConfidence: n(r.low_conf),
    noAnswer: n(r.no_answer),
    answerPartial: n(r.answer_partial),
    suggestedMapping: n(r.suggested),
  }));
}

/** Pending questions from source packs that were skipped by the loader are not in the database; the registry notes them. */
export function sumQueues(q: SourceQueue[]) {
  const keys = ["total", "pending", "verified", "rejected", "formulaLoss", "figure", "lowConfidence", "noAnswer", "answerPartial", "suggestedMapping"] as const;
  return Object.fromEntries(keys.map((k) => [k, q.reduce((t, r) => t + r[k], 0)])) as Record<(typeof keys)[number], number>;
}

export type ReviewOverview = {
  /** Non-demo official questions by review state (null state = imported before the pipeline, counted as pending). */
  states: Record<string, number>;
  /** The most common reasons questions are held, with how many share each. */
  reasons: { state: string; reason: string; n: number }[];
  /** Per source document: auto-verified, editor-verified, held and still pending. */
  byPaper: Map<number, { auto: number; editor: number; held: number; rejected: number }>;
};

/** Three small grouped queries over the review columns (indexed by review_state). */
export async function getReviewOverview(): Promise<ReviewOverview> {
  const db = await getDb();
  const [states, reasons, papers] = await Promise.all([
    db.all<{ state: string | null; n: number }>(sql`
      SELECT review_state AS state, COUNT(*) AS n FROM questions WHERE is_demo = 0 AND source_type <> 'AI_GENERATED' GROUP BY review_state`),
    db.all<{ state: string; reason: string; n: number }>(sql`
      SELECT review_state AS state, review_reason AS reason, COUNT(*) AS n FROM questions
      WHERE is_demo = 0 AND review_state LIKE 'HOLD%' AND verification_status = 'UNVERIFIED' AND review_reason <> ''
      GROUP BY review_state, review_reason ORDER BY n DESC LIMIT 24`),
    db.all<{ paper_id: number; auto: number; editor: number; held: number; rejected: number }>(sql`
      SELECT qs.paper_id,
        SUM(CASE WHEN q.review_state = 'AUTO_VERIFIED' AND q.verification_status = 'VERIFIED' THEN 1 ELSE 0 END) AS auto,
        SUM(CASE WHEN q.verification_status = 'VERIFIED' AND (q.review_state IS NULL OR q.review_state <> 'AUTO_VERIFIED') THEN 1 ELSE 0 END) AS editor,
        SUM(CASE WHEN q.verification_status = 'UNVERIFIED' AND q.review_state LIKE 'HOLD%' THEN 1 ELSE 0 END) AS held,
        SUM(CASE WHEN q.verification_status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected
      FROM question_sources qs JOIN questions q ON q.id = qs.question_id
      WHERE q.is_demo = 0 GROUP BY qs.paper_id`),
  ]);
  const n = (v: unknown) => Number(v ?? 0);
  return {
    states: Object.fromEntries(states.map((s) => [s.state ?? "PENDING_REVIEW", n(s.n)])),
    reasons: reasons.map((r) => ({ state: r.state, reason: r.reason, n: n(r.n) })),
    byPaper: new Map(papers.map((p) => [n(p.paper_id), { auto: n(p.auto), editor: n(p.editor), held: n(p.held), rejected: n(p.rejected) }])),
  };
}
