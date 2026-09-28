/**
 * Import pipeline: segment extracted paper text into candidate questions.
 *
 * Stages covered here (all deterministic, no AI):
 *   document structure (sections, pages) → question segmentation → question numbers →
 *   marks → MCQ/assertion-reason options → question type → extraction confidence.
 *
 * It only extracts structure that is visibly present in the text. It never infers a year,
 * board, source or answer; provenance comes only from the source document the editor chose.
 * Page breaks are form feeds (\f) or lines like "=== Page 3 ===".
 */

import type { Confidence, QuestionType } from "@/db/schema";

export type ParsedItem = {
  position: number;
  questionNumber: string | null;
  section: string | null;
  text: string;
  marks: number | null;
  page: number | null;
  options: string[] | null;
  type: QuestionType;
  confidence: Confidence;
  issues: string[];
};

const SECTION_RE = /^\s*section\s*[-–:]?\s*([A-Z]|[IVX]+|\d+)\b.*$/i;
const QUESTION_RE = /^\s*(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[.):]\s+(.*)$/i;
const PAGE_RE = /^\s*=+\s*page\s+(\d{1,4})\s*=+\s*$/i;
// "[4]", "(4)", "[4 marks]", "(2 marks)", "4 marks" at end of a line.
const MARKS_END_RE = /[\[(]\s*(\d{1,2})\s*(?:marks?|m)?\s*[\])]\s*$|\b(\d{1,2})\s*marks?\s*$/i;
// Options printed as (A) … (B) … or (a) … (b) …, inline or on separate lines.
const OPTION_SPLIT_RE = /\(\s*([A-Da-d])\s*\)\s*/g;

function takeMarks(line: string): { line: string; marks: number | null } {
  const m = line.match(MARKS_END_RE);
  if (!m) return { line, marks: null };
  const n = Number(m[1] ?? m[2]);
  if (!(n >= 1 && n <= 20)) return { line, marks: null };
  return { line: line.slice(0, m.index).trimEnd(), marks: n };
}

/** Splits "stem (A) x (B) y (C) z (D) w" into stem + 4 options, only when the labels run A–D in order. */
export function splitOptions(text: string): { stem: string; options: string[] } | null {
  const marks = [...text.matchAll(OPTION_SPLIT_RE)];
  if (marks.length < 4) return null;
  // Use the last run of A, B, C, D labels (stems can contain "(a)" parts).
  for (let i = marks.length - 4; i >= 0; i--) {
    const run = marks.slice(i, i + 4);
    const letters = run.map((m) => m[1].toUpperCase()).join("");
    if (letters !== "ABCD") continue;
    const stem = text.slice(0, run[0].index).trim();
    const options = run.map((m, k) => text.slice(m.index! + m[0].length, k < 3 ? run[k + 1].index : undefined).trim());
    if (stem.length < 3 || options.some((o) => !o)) return null;
    return { stem, options };
  }
  return null;
}

function classify(text: string, marks: number | null, hasOptions: boolean): QuestionType {
  if (hasOptions && /assertion\s*\(A\)/i.test(text)) return "ASSERTION_REASON";
  if (hasOptions) return "MCQ";
  if (/read the (following|given) (passage|case|text|source)|case[- ]based|source[- ]based/i.test(text)) return "CASE_BASED";
  if (marks !== null && marks >= 4) return "LONG_ANSWER";
  return "SHORT_ANSWER";
}

/**
 * @param pageConfidence optional OCR confidence (0–100) per page number; pages below 70 are flagged.
 */
export function parsePaperText(raw: string, pageConfidence?: Record<number, number>): ParsedItem[] {
  const lines = raw.replace(/\r\n?/g, "\n").replace(/\f/g, "\n=== Page break ===\n").split("\n");
  const items: ParsedItem[] = [];
  let section: string | null = null;
  let page = 1;
  let sawPages = /\f|=+\s*page\s+\d/i.test(raw);
  let current: { number: string | null; lines: string[]; marks: number | null; section: string | null; page: number } | null = null;

  const flush = () => {
    if (!current) return;
    let text = current.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length >= 5) {
      const split = splitOptions(text.replace(/\s*\n\s*/g, " "));
      if (split) text = split.stem;
      const issues: string[] = [];
      const type = classify(split ? split.stem : text, current.marks, Boolean(split));
      if (current.marks === null) issues.push("Marks not found in the text.");
      if (current.number === null) issues.push("No question number detected.");
      if (/\uFFFD|�/.test(text)) issues.push("Contains characters that could not be read.");
      if (/\b(figure|diagram|graph|table)\b|given (below|alongside)|shown (below|alongside)/i.test(text)) issues.push("May refer to a figure or table; check the source page.");
      const ocr = pageConfidence?.[current.page];
      if (ocr !== undefined && ocr < 70) issues.push(`OCR confidence on page ${current.page} is ${Math.round(ocr)}%.`);
      const confidence: Confidence =
        issues.some((i) => i.startsWith("OCR") || i.startsWith("Contains")) ? "LOW" : issues.length ? "MEDIUM" : "HIGH";
      items.push({
        position: items.length + 1,
        questionNumber: current.number,
        section: current.section,
        text,
        marks: current.marks,
        page: sawPages ? current.page : null,
        options: split?.options ?? null,
        type,
        confidence,
        issues,
      });
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const pm = line.match(PAGE_RE);
    if (pm || line === "=== Page break ===") {
      page = pm ? Number(pm[1]) : page + 1;
      sawPages = true;
      continue;
    }
    const sec = line.match(SECTION_RE);
    if (sec && line.trim().length < 60) {
      flush();
      section = sec[1].toUpperCase();
      continue;
    }
    const q = line.match(QUESTION_RE);
    if (q) {
      flush();
      const { line: rest, marks } = takeMarks(q[2]);
      current = { number: q[1], lines: [rest], marks, section, page };
      continue;
    }
    if (!current) {
      if (line.trim()) current = { number: null, lines: [], marks: null, section, page };
      else continue;
    }
    const { line: rest, marks } = takeMarks(line);
    if (marks !== null) current.marks = (current.marks ?? 0) + marks;
    current.lines.push(rest);
  }
  flush();
  return items;
}

const STOP = new Set(["what", "which", "state", "explain", "define", "write", "give", "name", "with", "from", "that", "this", "their", "when", "where", "does", "reason", "following", "study", "meant"]);

/** Crude stemming so "groups"/"group" and "periodic"/"period" meet; good enough for a suggestion. */
function stems(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
    .map((w) => w.replace(/(icity|ical|ic|ies|es|s)$/, ""))
    .filter((w) => w.length > 2);
}

/** Keyword-overlap chapter suggestion. Shown to the admin as a suggestion only. */
export function suggestChapter(text: string, chapters: { id: number; name: string; keywords: string }[]): number | null {
  const words = new Set(stems(text));
  let best: { id: number; score: number } | null = null;
  for (const ch of chapters) {
    const nameStems = new Set(stems(ch.name));
    const kws = new Set([...nameStems, ...stems(ch.keywords)]);
    let score = 0;
    // Matches on the chapter name count double.
    for (const w of kws) if (words.has(w)) score += nameStems.has(w) ? 2 : 1;
    if (score > 0 && (!best || score > best.score)) best = { id: ch.id, score };
  }
  return best?.id ?? null;
}
