import { DIFFICULTIES, QUESTION_TYPES, SOURCE_TYPES, VERIFICATION_STATUSES } from "@/db/schema";
import type { QuestionFilters } from "@/lib/data/questions";

export type SearchParams = Record<string, string | string[] | undefined>;

export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function pick<T extends readonly string[]>(list: T, v: string): T[number] | undefined {
  return (list as readonly string[]).includes(v) ? (v as T[number]) : undefined;
}

/** Parses untrusted query-string filters into a validated QuestionFilters object. */
export function parseQuestionFilters(sp: SearchParams): QuestionFilters {
  const int = (k: string) => {
    const n = Number(one(sp[k]));
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const demo = one(sp.demo);
  return {
    subjectId: int("subject"),
    chapterId: int("chapter"),
    sourceType: pick(SOURCE_TYPES, one(sp.source)),
    status: pick(VERIFICATION_STATUSES, one(sp.status)),
    type: pick(QUESTION_TYPES, one(sp.type)),
    difficulty: pick(DIFFICULTIES, one(sp.difficulty)),
    q: one(sp.q).slice(0, 100) || undefined,
    demo: demo === "only" || demo === "exclude" ? demo : undefined,
    page: int("page") ?? 1,
  };
}

export function filtersToQuery(f: QuestionFilters, overrides: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  const base: Record<string, string | number | undefined> = {
    subject: f.subjectId,
    chapter: f.chapterId,
    source: f.sourceType,
    status: f.status,
    type: f.type,
    difficulty: f.difficulty,
    q: f.q,
    demo: f.demo,
    page: f.page && f.page > 1 ? f.page : undefined,
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== "") params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : "";
}
