/**
 * Import pipeline, step 1: split pasted paper text into candidate questions.
 * Pure and deterministic. It extracts structure (numbers, sections, marks) that is visibly present
 * in the text. It never infers a year, board or source; those come only from the admin.
 */

export type ParsedItem = {
  position: number;
  questionNumber: string | null;
  section: string | null;
  text: string;
  marks: number | null;
};

const SECTION_RE = /^\s*section\s*[-–:]?\s*([A-Z]|[IVX]+|\d+)\b.*$/i;
const QUESTION_RE = /^\s*(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[.):]\s+(.*)$/i;
// "[4]", "(4)", "[4 marks]", "(2 marks)", "4 marks" at end of a line.
const MARKS_END_RE = /[\[(]\s*(\d{1,2})\s*(?:marks?|m)?\s*[\])]\s*$|\b(\d{1,2})\s*marks?\s*$/i;

function takeMarks(line: string): { line: string; marks: number | null } {
  const m = line.match(MARKS_END_RE);
  if (!m) return { line, marks: null };
  const n = Number(m[1] ?? m[2]);
  if (!(n >= 1 && n <= 20)) return { line, marks: null };
  return { line: line.slice(0, m.index).trimEnd(), marks: n };
}

export function parsePaperText(raw: string): ParsedItem[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const items: ParsedItem[] = [];
  let section: string | null = null;
  let current: { number: string | null; lines: string[]; marks: number | null; section: string | null } | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length >= 5) {
      items.push({ position: items.length + 1, questionNumber: current.number, section: current.section, text, marks: current.marks });
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
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
      current = { number: q[1], lines: [rest], marks, section };
      continue;
    }
    if (!current) {
      if (line.trim()) current = { number: null, lines: [], marks: null, section };
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
