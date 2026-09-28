/**
 * Turns a free-text search ("Class 10 CBSE electricity", "2026 Science QP 31/2/1",
 * "repeated questions chemical reactions") into structured filters plus leftover words.
 *
 * Pure and catalog-driven: it only recognises boards, classes, subjects and chapters that exist in
 * the catalog passed in, so it can never "understand" something the bank doesn't have. Whatever
 * isn't recognised stays as text and is matched against question wording.
 */

export type IntentCatalog = {
  id: number;
  slug: string;
  name: string;
  classes: {
    id: number;
    level: number;
    name: string;
    subjects: { id: number; slug: string; name: string; chapters: { id: number; slug: string; name: string }[] }[];
  }[];
}[];

export type IntentChip = { kind: "board" | "class" | "subject" | "chapter" | "year" | "paper" | "question" | "type" | "marks" | "repeated" | "pyq" | "doc" | "answer" | "text"; label: string };

export type SearchIntent = {
  boardId?: number;
  classId?: number;
  /** Class level when the class itself isn't unique (e.g. "class 10" without a board). */
  classLevel?: number;
  subjectId?: number;
  chapterId?: number;
  year?: number;
  paperCode?: string;
  questionNumber?: string;
  type?: "MCQ" | "ASSERTION_REASON" | "CASE_BASED" | "NUMERICAL" | "SHORT_ANSWER" | "LONG_ANSWER" | "FILL_BLANK";
  marks?: number;
  repeatedOnly?: boolean;
  pyqOnly?: boolean;
  /** Kind of source document: "specimen", "sample paper", "question bank", "school paper". */
  paperType?: "SPECIMEN" | "SAMPLE" | "QUESTION_BANK" | "SCHOOL_EXAM";
  hasAnswer?: boolean;
  hasFigure?: boolean;
  /** Words that were not recognised as filters; matched against question text. */
  text?: string;
  chips: IntentChip[];
};

const STOP = new Set(
  "a an and are about all any as at by class classes for from give how in into is me of on or paper papers please previous question questions qp q.p set show the to what which with year years pyq pyqs board exam exams chapter chapters topic topics find related".split(
    " ",
  ),
);

/** Common student shorthand for subject names. Values are subject slugs that may exist in the catalog. */
const SUBJECT_ALIASES: Record<string, string[]> = {
  mathematics: ["maths", "math", "mathematics", "mathematic"],
  physics: ["physics", "phy", "phys"],
  chemistry: ["chemistry", "chem"],
  biology: ["biology", "bio"],
  science: ["science", "sci"],
  "social-science": ["social science", "sst", "social studies", "social"],
  "history-civics": ["history and civics", "history & civics", "history civics", "civics", "history"],
  geography: ["geography", "geo"],
  english: ["english"],
  "computer-applications": ["computer applications", "computer application", "computers", "computer"],
  "computer-science": ["computer science", "cs"],
};

const ROMAN: Record<string, number> = { vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };

const TYPE_WORDS: [RegExp, NonNullable<SearchIntent["type"]>, string][] = [
  [/\bmcqs?\b|\bmultiple[- ]choice\b|\bobjective\b/, "MCQ", "MCQs"],
  [/\bassertion[- ]?(and[- ]?)?reason(ing)?\b|\bA-?R\b/, "ASSERTION_REASON", "Assertion–reason"],
  [/\bcase[- ]?(based|study|studies)\b|\bsource[- ]based\b/, "CASE_BASED", "Case-based"],
  [/\bnumericals?\b/, "NUMERICAL", "Numerical"],
  [/\bfill (in )?the blanks?\b/, "FILL_BLANK", "Fill in the blanks"],
  [/\blong[- ]answers?\b/, "LONG_ANSWER", "Long answer"],
  [/\bshort[- ]answers?\b/, "SHORT_ANSWER", "Short answer"],
];

const DOC_WORDS: [RegExp, NonNullable<SearchIntent["paperType"]>, string][] = [
  [/\bspecimens?( papers?)?\b/, "SPECIMEN", "Official specimen papers"],
  [/\bsample (question )?papers?\b|\bsqps?\b/, "SAMPLE", "Official sample papers"],
  [/\b(question|item) banks?\b/, "QUESTION_BANK", "Official question banks"],
  [/\bschool (exam )?papers?\b/, "SCHOOL_EXAM", "School papers"],
];

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9/&.\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const words = (s: string) => norm(s).replace(/[&.-]/g, " ").split(" ").filter(Boolean);

export function interpretQuery(raw: string, catalog: IntentCatalog): SearchIntent {
  const out: SearchIntent = { chips: [] };
  let rest = ` ${norm(raw)} `;
  const take = (re: RegExp) => {
    const m = rest.match(re);
    if (m) rest = rest.replace(m[0], " ");
    return m;
  };

  // Paper code, e.g. 31/2/1 or 430/4/1 (before years and question numbers so its digits aren't reused).
  const code = take(/\b(\d{2,3}\/\d{1,2}\/\d{1,2})\b/);
  if (code) {
    out.paperCode = code[1];
    out.chips.push({ kind: "paper", label: `Q.P. ${code[1]}` });
  }
  const qn = take(/\b(?:q|q\.|question|ques)\s?(?:no\.?\s?)?(\d{1,2})\b/);
  if (qn) {
    out.questionNumber = qn[1];
    out.chips.push({ kind: "question", label: `Question ${qn[1]}` });
  }
  const year = take(/\b(20[0-3]\d|19[89]\d)\b/);
  if (year) {
    out.year = Number(year[1]);
    out.chips.push({ kind: "year", label: year[1] });
  }
  const marks = take(/\b(\d{1,2})\s?-?\s?marks?\b|\b(\d{1,2})\s?-?\s?markers?\b/);
  if (marks) {
    out.marks = Number(marks[1] ?? marks[2]);
    out.chips.push({ kind: "marks", label: `${out.marks} marks` });
  }
  if (take(/\b(most )?(repeated|recurring|frequently asked|repeat)\b/)) {
    out.repeatedOnly = true;
    out.chips.push({ kind: "repeated", label: "Repeated in 2+ exam years" });
  }
  if (take(/\bprevious[- ]year\b|\bpast papers?\b|\bpyqs?\b/)) {
    out.pyqOnly = true;
    out.chips.push({ kind: "pyq", label: "Verified PYQs" });
  }
  for (const [re, paperType, label] of DOC_WORDS) {
    if (take(re)) {
      out.paperType = paperType;
      out.chips.push({ kind: "doc", label });
      break;
    }
  }
  if (take(/\bwith (official )?(answers?|solutions?|answer keys?|marking schemes?)\b|\bsolved\b/)) {
    out.hasAnswer = true;
    out.chips.push({ kind: "answer", label: "With official answer" });
  }
  // Only explicit "with/without figures" phrases: "ray diagram" is a topic, not a filter.
  const fig = take(/\b(with|without|no) (figures?|diagrams?|graphs?|pictures?)\b/);
  if (fig) {
    out.hasFigure = fig[1] === "with";
    out.chips.push({ kind: "answer", label: out.hasFigure ? "Has a figure" : "No figure needed" });
  }
  for (const [re, type, label] of TYPE_WORDS) {
    if (take(re)) {
      out.type = type;
      out.chips.push({ kind: "type", label });
      break;
    }
  }

  // Board. "ISC" is the CISCE Class 12 examination, stored under the ICSE board.
  let boardSlug: string | null = null;
  let iscLevel: number | null = null;
  const b = take(/\b(icse|isc|cbse|cisce)\b/);
  if (b) {
    boardSlug = b[1] === "cbse" ? "cbse" : "icse";
    if (b[1] === "isc") iscLevel = 12;
  }
  const board = boardSlug ? catalog.find((x) => x.slug === boardSlug) : undefined;
  if (board) {
    out.boardId = board.id;
    out.chips.push({ kind: "board", label: b![1] === "isc" ? "ISC" : board.name });
  }

  // Class: "class 10", "class x", "10th", "grade 9", "std 8".
  let level: number | null = null;
  const c = take(/\b(?:class|grade|std|standard)\s?(\d{1,2}|xii|xi|x|ix|viii|vii|vi)\b/) ?? take(/\b(\d{1,2})(?:st|nd|rd|th)\b/);
  if (c) {
    const v = c[1];
    const n = /^\d+$/.test(v) ? Number(v) : ROMAN[v];
    if (n >= 6 && n <= 12) level = n;
  }
  level ??= iscLevel;

  // Candidate classes (by board and level) that the rest of the query is resolved against.
  const classes = catalog.flatMap((bd) => bd.classes.map((cl) => ({ ...cl, board: bd }))).filter((cl) => (!board || cl.board.id === board.id) && (level === null || cl.level === level));
  if (level !== null) {
    out.classLevel = level;
    const exact = classes.length === 1 ? classes[0] : null;
    if (exact) out.classId = exact.id;
    out.chips.push({ kind: "class", label: `Class ${level}` });
  }

  // Subject: the longest alias found in the text that exists in a candidate class.
  const subjectSlugsAvailable = new Set(classes.flatMap((cl) => cl.subjects.map((s) => s.slug)));
  let subjectSlug: string | null = null;
  const aliasHits = Object.entries(SUBJECT_ALIASES)
    .flatMap(([slug, aliases]) => aliases.map((a) => ({ slug, a })))
    .filter(({ slug, a }) => subjectSlugsAvailable.has(slug) && new RegExp(`\\b${a.replace(/[&]/g, "\\&")}\\b`).test(rest))
    .sort((x, y) => y.a.length - x.a.length);
  if (aliasHits.length) {
    subjectSlug = aliasHits[0].slug;
    take(new RegExp(`\\b${aliasHits[0].a.replace(/[&]/g, "\\&")}\\b`));
  }

  // Chapter: best overlap between the remaining words and chapter names in the candidate subjects.
  const candidateSubjects = classes.flatMap((cl) => cl.subjects.filter((s) => !subjectSlug || s.slug === subjectSlug).map((s) => ({ ...s, cls: cl })));
  const restWords = words(rest).filter((w) => !STOP.has(w) && w.length > 1);
  let best: { score: number; ch: { id: number; name: string }; subj: (typeof candidateSubjects)[number]; used: string[] } | null = null;
  if (restWords.length) {
    for (const s of candidateSubjects) {
      for (const ch of s.chapters) {
        const chWords = words(ch.name).filter((w) => !STOP.has(w) && w.length > 2);
        if (!chWords.length) continue;
        const used = restWords.filter((w) => chWords.some((cw) => cw === w || (w.length >= 5 && (cw.startsWith(w) || w.startsWith(cw)))));
        if (!used.length) continue;
        // Share of the chapter name matched, with a bonus for matching more of the query.
        const score = used.length / chWords.length + used.length * 0.25;
        if (!best || score > best.score) best = { score, ch, subj: s, used };
      }
    }
  }
  // Require a meaningful match: the whole short name, or at least half of a longer one.
  if (best && best.score >= 0.75) {
    out.chapterId = best.ch.id;
    out.subjectId = best.subj.id;
    out.classId ??= best.subj.cls.id;
    out.boardId ??= best.subj.cls.board.id;
    const usedSet = new Set(best.used);
    rest = ` ${words(rest).filter((w) => !usedSet.has(w)).join(" ")} `;
  } else if (subjectSlug) {
    const matches = candidateSubjects;
    if (matches.length === 1) {
      out.subjectId = matches[0].id;
      out.classId ??= matches[0].cls.id;
      out.boardId ??= matches[0].cls.board.id;
    }
  }
  if (out.subjectId) {
    const s = candidateSubjects.find((x) => x.id === out.subjectId)!;
    out.chips.push({ kind: "subject", label: s.name });
    if (!board && out.boardId) out.chips.push({ kind: "board", label: s.cls.board.name });
    if (level === null && out.classId) out.chips.push({ kind: "class", label: s.cls.name });
  } else if (subjectSlug) {
    const name = candidateSubjects[0]?.name ?? subjectSlug;
    out.chips.push({ kind: "subject", label: `${name} (any class)` });
  }
  if (out.chapterId && best) out.chips.push({ kind: "chapter", label: best.ch.name });

  const text = words(rest)
    .filter((w) => !STOP.has(w))
    .join(" ")
    .trim();
  if (text.length >= 2) {
    out.text = text;
    out.chips.push({ kind: "text", label: `“${text}”` });
  }
  // When the subject is known only by name (several classes), keep the candidates for the caller.
  if (!out.subjectId && subjectSlug) (out as SearchIntent & { subjectSlug?: string }).subjectSlug = subjectSlug;
  return out;
}

/** Subject ids matching a subject named without a unique class, e.g. "physics" with no class given. */
export function subjectIdsFor(intent: SearchIntent, catalog: IntentCatalog): number[] {
  const slug = (intent as SearchIntent & { subjectSlug?: string }).subjectSlug;
  if (!slug) return [];
  return catalog
    .filter((b) => !intent.boardId || b.id === intent.boardId)
    .flatMap((b) => b.classes)
    .filter((c) => !intent.classId || c.id === intent.classId)
    .flatMap((c) => c.subjects.filter((s) => s.slug === slug).map((s) => s.id));
}
