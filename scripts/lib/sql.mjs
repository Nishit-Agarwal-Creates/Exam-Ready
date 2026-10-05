// Shared helpers for the SQL generators (seed, source packs, taxonomy).
import { createHash } from "node:crypto";

export const q = (v) =>
  v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "1" : "0") : `'${String(v).replace(/'/g, "''")}'`;

/** Must match normaliseForHash in src/lib/text.ts */
export function normaliseForHash(text) {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export function contentHash(text) {
  return createHash("sha1").update(normaliseForHash(text)).digest("hex");
}

export const TYPE_MAP = { MCQ: "MCQ", ASSERTION_REASON: "ASSERTION_REASON", FILL_BLANK: "FILL_BLANK", SHORT_ANSWER: "SHORT_ANSWER", LONG_ANSWER: "LONG_ANSWER", CASE_BASED: "CASE_BASED", NUMERICAL: "NUMERICAL" };

/**
 * The stored columns for one pack question (shared by build-sources and consolidate so both write the same content).
 * Marks only when the paper prints this item's own mark; otherwise 0 with the status saying why (never inferred).
 */
export function questionColumns(item) {
  const type = TYPE_MAP[item.type];
  const hasOptions = Array.isArray(item.options) && item.options.length >= 2;
  const correct = item.officialAnswer && Number.isInteger(item.officialAnswer.correctOption) ? item.officialAnswer.correctOption : null;
  const answerKey = (type === "MCQ" || type === "ASSERTION_REASON") && hasOptions && correct !== null ? JSON.stringify({ correctOption: correct }) : null;
  const marksStatus = ["GROUP_TOTAL", "NOT_PRINTED", "FRACTIONAL"].includes(item.marksStatus) ? item.marksStatus : "PRINTED";
  return {
    type,
    hasOptions,
    options: hasOptions ? JSON.stringify(item.options) : null,
    answerKey,
    answerText: item.officialAnswer?.text ?? "",
    answerSource: item.officialAnswer ? "OFFICIAL_SCHEME" : "NONE",
    marksStatus,
    marks: marksStatus === "PRINTED" ? item.marks : 0,
    figure: Array.isArray(item.figures) && item.figures.length ? JSON.stringify(item.figures) : null,
    hash: contentHash(item.text),
  };
}

/** Word-set Jaccard similarity. Must match similarity() in src/lib/text.ts */
export function similarity(a, b) {
  const wa = new Set(normaliseForHash(a).split(" ").filter((w) => w.length > 2));
  const wb = new Set(normaliseForHash(b).split(" ").filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

export function slugify(s) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const boardIdSql = (board) => `(SELECT id FROM boards WHERE slug = ${q(board)})`;
export const classIdSql = (board, level) => `(SELECT c.id FROM classes c JOIN boards b ON b.id = c.board_id WHERE b.slug = ${q(board)} AND c.level = ${level})`;
export const subjectIdSql = (board, level, subject) =>
  `(SELECT s.id FROM subjects s JOIN classes c ON c.id = s.class_id JOIN boards b ON b.id = c.board_id WHERE b.slug = ${q(board)} AND c.level = ${level} AND s.slug = ${q(subject)})`;
export const chapterIdSql = (board, level, subject, chapter) =>
  `(SELECT ch.id FROM chapters ch WHERE ch.slug = ${q(chapter)} AND ch.subject_id = ${subjectIdSql(board, level, subject)})`;

export function upsertBoard(b) {
  return `INSERT INTO boards (slug, name, full_name, description, is_active, sort_order) VALUES (${q(b.slug)}, ${q(b.name)}, ${q(b.fullName)}, ${q(
    b.description ?? "",
  )}, 1, ${b.sortOrder ?? 0}) ON CONFLICT(slug) DO UPDATE SET name = excluded.name, full_name = excluded.full_name, description = CASE WHEN excluded.description <> '' THEN excluded.description ELSE boards.description END, sort_order = excluded.sort_order;`;
}

export function upsertClass(board, level, name) {
  return `INSERT INTO classes (board_id, level, slug, name, is_active) SELECT id, ${level}, 'class-${level}', ${q(name)}, 1 FROM boards WHERE slug = ${q(
    board,
  )} ON CONFLICT(board_id, slug) DO UPDATE SET name = excluded.name;`;
}

export function upsertSubject(board, level, slug, name, overview, studyTips, sortOrder) {
  return `INSERT INTO subjects (class_id, slug, name, overview, study_tips, sort_order) SELECT ${classIdSql(board, level)}, ${q(slug)}, ${q(name)}, ${q(
    overview ?? "",
  )}, ${q(JSON.stringify(studyTips ?? []))}, ${sortOrder} WHERE ${classIdSql(board, level)} IS NOT NULL ON CONFLICT(class_id, slug) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order, overview = CASE WHEN excluded.overview <> '' THEN excluded.overview ELSE subjects.overview END, study_tips = CASE WHEN excluded.study_tips <> '[]' THEN excluded.study_tips ELSE subjects.study_tips END;`;
}

export function upsertChapter(board, level, subject, ch, order) {
  const sid = subjectIdSql(board, level, subject);
  return `INSERT INTO chapters (subject_id, slug, name, summary, sort_order) SELECT ${sid}, ${q(ch.slug)}, ${q(ch.name)}, ${q(ch.summary ?? "")}, ${order} WHERE ${sid} IS NOT NULL ON CONFLICT(subject_id, slug) DO UPDATE SET name = excluded.name, summary = excluded.summary, sort_order = excluded.sort_order;`;
}

export function upsertTopic(board, level, subject, chapterSlug, topic, order) {
  const cid = chapterIdSql(board, level, subject, chapterSlug);
  return `INSERT INTO topics (chapter_id, slug, name, sort_order) SELECT ${cid}, ${q(topic.slug)}, ${q(topic.name)}, ${order} WHERE ${cid} IS NOT NULL ON CONFLICT(chapter_id, slug) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order;`;
}

/** SQL for everything in src/data/taxonomy.json. Idempotent. */
export function taxonomySql(tax) {
  const out = [];
  const order = (slug) => (tax.subjectOrder.indexOf(slug) + 1) || 9;
  for (const b of tax.boards) {
    out.push(upsertBoard(b));
    for (const c of b.classes) {
      out.push(upsertClass(b.slug, c.level, c.name));
      for (const s of c.subjects) {
        const d = c.details?.[s];
        out.push(upsertSubject(b.slug, c.level, s, tax.subjectNames[s] ?? s, d?.overview, d?.studyTips, order(s)));
        (d?.chapters ?? []).forEach((ch, i) => {
          out.push(upsertChapter(b.slug, c.level, s, ch, i + 1));
          (ch.topics ?? []).forEach((t, j) => out.push(upsertTopic(b.slug, c.level, s, ch.slug, { slug: slugify(t), name: t }, j + 1)));
        });
      }
    }
  }
  return out;
}
