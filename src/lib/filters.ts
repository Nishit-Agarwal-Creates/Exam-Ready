import { DIFFICULTIES, QUESTION_TYPES, SOURCE_TYPES, VERIFICATION_STATUSES } from "@/db/schema";
import type { QuestionFilters } from "@/lib/data/questions";

export type SearchParams = Record<string, string | string[] | undefined>;

export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function pick<T extends readonly string[]>(list: T, v: string): T[number] | undefined {
  return (list as readonly string[]).includes(v) ? (v as T[number]) : undefined;
}

const int = (sp: SearchParams, k: string, max = 1_000_000) => {
  const n = Number(one(sp[k]));
  return Number.isInteger(n) && n > 0 && n <= max ? n : undefined;
};

/** Parses untrusted query-string filters into a validated QuestionFilters object. */
export function parseQuestionFilters(sp: SearchParams): QuestionFilters {
  const demo = one(sp.demo);
  const issues = one(sp.issues);
  const source = one(sp.source);
  return {
    boardId: int(sp, "board"),
    classId: int(sp, "class"),
    subjectId: int(sp, "subject"),
    chapterId: int(sp, "chapter"),
    sourceType: pick(SOURCE_TYPES, source),
    realPyqOnly: source === "pyq" ? true : undefined,
    repeatedOnly: one(sp.repeated) === "1" ? true : undefined,
    status: pick(VERIFICATION_STATUSES, one(sp.status)),
    type: pick(QUESTION_TYPES, one(sp.type)),
    difficulty: pick(DIFFICULTIES, one(sp.difficulty)),
    marks: int(sp, "marks", 20),
    year: int(sp, "year", 2100),
    paperId: int(sp, "paper"),
    q: one(sp.q).slice(0, 100) || undefined,
    demo: demo === "only" || demo === "exclude" ? demo : undefined,
    issues: issues === "figure" || issues === "low" || issues === "any" ? issues : undefined,
    page: int(sp, "page", 10_000) ?? 1,
  };
}

export function filtersToQuery(f: QuestionFilters, overrides: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  const base: Record<string, string | number | undefined> = {
    board: f.boardId,
    class: f.classId,
    subject: f.subjectId,
    chapter: f.chapterId,
    source: f.realPyqOnly ? "pyq" : f.sourceType,
    repeated: f.repeatedOnly ? "1" : undefined,
    status: f.status,
    type: f.type,
    difficulty: f.difficulty,
    marks: f.marks,
    year: f.year,
    paper: f.paperId,
    q: f.q,
    demo: f.demo,
    issues: f.issues,
    page: f.page && f.page > 1 ? f.page : undefined,
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== "") params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : "";
}
