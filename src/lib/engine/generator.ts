/**
 * Paper generation engine. Pure functions only (no database access), so it can be unit tested.
 *
 * Guarantees:
 *  - PYQ_ONLY never uses anything other than verified PYQs. If they cannot make the requested
 *    total, it fails with the largest achievable total instead of padding the paper.
 *  - PYQ_PRIORITY uses verified PYQs first, then official samples, then reviewed contributed
 *    questions, then reviewed AI questions, only as far as needed.
 *  - The returned composition is computed from the questions actually selected.
 */
import type { Difficulty, PaperMode, QuestionType, SourceType } from "@/db/schema";

export type PoolQuestion = {
  id: number;
  chapterId: number;
  topicId: number | null;
  questionType: QuestionType;
  marks: number;
  difficulty: Difficulty;
  sourceType: SourceType;
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "REJECTED";
  isPublished: boolean;
  isDemo: boolean;
};

export type DifficultyPref = "MIXED" | Difficulty;

export type GenerateRequest = {
  mode: PaperMode;
  totalMarks: number;
  difficulty: DifficultyPref;
  seed: number;
};

export type Selected = { questionId: number; marks: number; section: string };

export type Composition = Record<SourceType, { count: number; marks: number }>;

export type GenerateSuccess = {
  ok: true;
  selected: Selected[];
  totalMarks: number;
  composition: Composition;
  notices: string[];
};

export type GenerateFailure = {
  ok: false;
  reason: "NO_QUESTIONS" | "INSUFFICIENT";
  message: string;
  /** Largest total ≤ requested that the eligible pool can make exactly (0 if none). */
  maxAchievableMarks: number;
  availableMarks: number;
};

export type GenerateResult = GenerateSuccess | GenerateFailure;

export const TIER_ORDER: SourceType[] = ["VERIFIED_PYQ", "OFFICIAL_SAMPLE", "USER_CONTRIBUTED", "AI_SUPPLEMENTARY"];

export const MODE_LABELS: Record<PaperMode, { name: string; description: string }> = {
  PYQ_ONLY: {
    name: "PYQ only",
    description: "Only verified previous-year questions. If there aren't enough for your paper, you'll be told and offered a smaller one.",
  },
  PYQ_PRIORITY: {
    name: "PYQ priority",
    description: "As many verified PYQs as possible. Any gaps are filled with clearly labelled non-PYQ questions.",
  },
  EXAM_SIMULATION: {
    name: "Exam simulation",
    description: "Board-style structure: Section A short answers, Section B longer answers, timed like the real paper.",
  },
};

export function emptyComposition(): Composition {
  return {
    VERIFIED_PYQ: { count: 0, marks: 0 },
    OFFICIAL_SAMPLE: { count: 0, marks: 0 },
    USER_CONTRIBUTED: { count: 0, marks: 0 },
    AI_SUPPLEMENTARY: { count: 0, marks: 0 },
  };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Questions a mode may draw from. Unverified, rejected and unpublished questions are never used. */
export function eligiblePool(pool: PoolQuestion[], mode: PaperMode): PoolQuestion[] {
  return pool.filter(
    (q) => q.isPublished && q.verificationStatus === "VERIFIED" && (mode !== "PYQ_ONLY" || q.sourceType === "VERIFIED_PYQ"),
  );
}

/** Largest subset-sum ≤ target (0/1 knapsack on marks). */
export function maxAchievable(items: { marks: number }[], target: number): number {
  const reach = new Uint8Array(target + 1);
  reach[0] = 1;
  for (const it of items) {
    for (let s = target; s >= it.marks; s--) if (reach[s - it.marks]) reach[s] = 1;
  }
  for (let s = target; s >= 0; s--) if (reach[s]) return s;
  return 0;
}

/**
 * Minimum-cost subset of `items` whose marks sum exactly to `target`. Returns null when impossible.
 * Cost lets the caller prefer higher-priority sources.
 */
function exactFill<T extends { marks: number }>(items: T[], target: number, cost: (t: T) => number): T[] | null {
  if (target === 0) return [];
  const INF = Number.POSITIVE_INFINITY;
  const best = new Array<number>(target + 1).fill(INF);
  const choice: Array<Array<number>> = Array.from({ length: target + 1 }, () => []);
  best[0] = 0;
  items.forEach((it, idx) => {
    const c = cost(it);
    for (let s = target; s >= it.marks; s--) {
      const prev = best[s - it.marks];
      if (prev !== INF && prev + c < best[s]) {
        best[s] = prev + c;
        choice[s] = [...choice[s - it.marks], idx];
      }
    }
  });
  if (best[target] === INF) return null;
  return choice[target].map((i) => items[i]);
}

type Ranked = PoolQuestion & { tier: number; jitter: number; diffPenalty: number };

function rankItems(items: PoolQuestion[], difficulty: DifficultyPref, rng: () => number): Ranked[] {
  return items.map((q) => ({
    ...q,
    tier: TIER_ORDER.indexOf(q.sourceType),
    jitter: rng(),
    diffPenalty: difficulty === "MIXED" || q.difficulty === difficulty ? 0 : 1,
  }));
}

/** Round-robin across chapters within each tier so no single chapter dominates the paper. */
function interleave(items: Ranked[], rng: () => number): Ranked[] {
  const ordered: Ranked[] = [];
  const tiers = [...new Set(items.map((i) => i.tier))].sort((a, b) => a - b);
  for (const tier of tiers) {
    const inTier = items.filter((i) => i.tier === tier);
    const byChapter = new Map<number, Ranked[]>();
    for (const it of inTier) {
      const list = byChapter.get(it.chapterId) ?? [];
      list.push(it);
      byChapter.set(it.chapterId, list);
    }
    const buckets = [...byChapter.values()].map((list) => list.sort((a, b) => a.diffPenalty - b.diffPenalty || a.jitter - b.jitter));
    // Shuffle chapter order so repeated generations differ.
    buckets.sort(() => rng() - 0.5);
    let added = true;
    while (added) {
      added = false;
      for (const b of buckets) {
        const next = b.shift();
        if (next) {
          ordered.push(next);
          added = true;
        }
      }
    }
  }
  return ordered;
}

/** Selects questions summing exactly to `target`, preferring lower tiers. Returns null if impossible. */
function selectExact(items: Ranked[], target: number, rng: () => number): Ranked[] | null {
  if (target <= 0) return [];
  const total = items.reduce((s, i) => s + i.marks, 0);
  if (total < target) return null;

  const ordered = interleave(items, rng);
  const picked: Ranked[] = [];
  let remaining = target;
  for (const it of ordered) {
    // Stop the greedy pass at the first tier boundary that would need lower-priority material,
    // leaving the exact fill to decide how little of the next tier is needed.
    if (it.marks <= remaining) {
      picked.push(it);
      remaining -= it.marks;
      if (remaining === 0) break;
    }
  }
  if (remaining === 0) return picked;

  const cost = (i: Ranked) => 1 + i.tier * 50 + i.diffPenalty * 5 + i.jitter;
  const unused = () => ordered.filter((o) => !picked.includes(o));

  const fill = exactFill(unused(), remaining, cost);
  if (fill) return [...picked, ...fill];

  // Swap step: drop one or two greedy picks (lowest priority first) and retry the exact fill.
  const dropOrder = [...picked].sort((a, b) => b.tier - a.tier || b.jitter - a.jitter);
  for (const drop of dropOrder) {
    const kept = picked.filter((p) => p !== drop);
    const pool = ordered.filter((o) => !kept.includes(o));
    const f = exactFill(pool, remaining + drop.marks, cost);
    if (f) return [...kept, ...f];
  }
  for (let i = 0; i < Math.min(dropOrder.length, 12); i++) {
    for (let j = i + 1; j < Math.min(dropOrder.length, 12); j++) {
      const kept = picked.filter((p) => p !== dropOrder[i] && p !== dropOrder[j]);
      const pool = ordered.filter((o) => !kept.includes(o));
      const f = exactFill(pool, remaining + dropOrder[i].marks + dropOrder[j].marks, cost);
      if (f) return [...kept, ...f];
    }
  }
  // Last resort: pure minimum-cost exact fill over everything.
  return exactFill(ordered, target, cost);
}

const TYPE_ORDER: QuestionType[] = ["MCQ", "FILL_BLANK", "NUMERICAL", "SHORT_ANSWER", "LONG_ANSWER"];

function orderForPaper(items: Ranked[]): Ranked[] {
  return [...items].sort(
    (a, b) => a.marks - b.marks || TYPE_ORDER.indexOf(a.questionType) - TYPE_ORDER.indexOf(b.questionType) || a.chapterId - b.chapterId,
  );
}

function compositionOf(items: PoolQuestion[]): Composition {
  const c = emptyComposition();
  for (const q of items) {
    c[q.sourceType].count++;
    c[q.sourceType].marks += q.marks;
  }
  return c;
}

function difficultyNotice(items: PoolQuestion[], pref: DifficultyPref): string | null {
  if (pref === "MIXED") return null;
  const total = items.reduce((s, i) => s + i.marks, 0);
  const matching = items.filter((i) => i.difficulty === pref).reduce((s, i) => s + i.marks, 0);
  if (total && matching / total < 0.6) {
    return `Only ${Math.round((matching / total) * 100)}% of the marks are ${pref.toLowerCase()} questions. There weren't enough ${pref.toLowerCase()} questions for these chapters, so others were added to reach the total.`;
  }
  return null;
}

function failure(eligible: PoolQuestion[], target: number, mode: PaperMode): GenerateFailure {
  const availableMarks = eligible.reduce((s, q) => s + q.marks, 0);
  const best = maxAchievable(eligible, target);
  if (eligible.length === 0) {
    return {
      ok: false,
      reason: "NO_QUESTIONS",
      message:
        mode === "PYQ_ONLY"
          ? "There are no verified previous-year questions for this selection yet. Nothing will be made up to fill the gap."
          : "There are no reviewed questions for this selection yet.",
      maxAchievableMarks: 0,
      availableMarks: 0,
    };
  }
  return {
    ok: false,
    reason: "INSUFFICIENT",
    message:
      mode === "PYQ_ONLY"
        ? `There aren't enough verified previous-year questions to make a ${target}-mark paper from this selection. The verified questions available add up to ${availableMarks} marks, and the closest paper they can make is ${best} marks.`
        : `The question bank for this selection can make at most a ${best}-mark paper (${availableMarks} marks of reviewed questions in total).`,
    maxAchievableMarks: best,
    availableMarks,
  };
}

export function generatePaper(pool: PoolQuestion[], req: GenerateRequest): GenerateResult {
  const rng = mulberry32(req.seed);
  const eligible = eligiblePool(pool, req.mode);
  const target = req.totalMarks;
  const ranked = rankItems(eligible, req.difficulty, rng);
  const notices: string[] = [];

  if (req.mode === "EXAM_SIMULATION") {
    const short = ranked.filter((q) => q.marks <= 2);
    const long = ranked.filter((q) => q.marks >= 3);
    let targetA = Math.round(target / 2);
    let targetB = target - targetA;
    let a = selectExact(short, targetA, rng);
    let b = selectExact(long, targetB, rng);
    if (!a || !b) {
      // Rebalance sections when the bank is short of one kind of question.
      for (let shift = 1; shift <= target && (!a || !b); shift++) {
        for (const dir of [1, -1]) {
          const tA = Math.round(target / 2) + dir * shift;
          const tB = target - tA;
          if (tA < 0 || tB < 0) continue;
          const aa = selectExact(short, tA, rng);
          const bb = aa ? selectExact(long, tB, rng) : null;
          if (aa && bb) {
            a = aa;
            b = bb;
            targetA = tA;
            targetB = tB;
            break;
          }
        }
      }
      if (a && b) {
        notices.push(
          `Section A has ${targetA} marks and Section B has ${targetB} marks. An even split wasn't possible with the questions available for this selection.`,
        );
      }
    }
    if (!a || !b) return failure(eligible, target, req.mode);
    const selected: Selected[] = [
      ...orderForPaper(a).map((q) => ({ questionId: q.id, marks: q.marks, section: "A" })),
      ...orderForPaper(b).map((q) => ({ questionId: q.id, marks: q.marks, section: "B" })),
    ];
    const all = [...a, ...b];
    const dn = difficultyNotice(all, req.difficulty);
    if (dn) notices.push(dn);
    return { ok: true, selected, totalMarks: target, composition: compositionOf(all), notices };
  }

  const picked = selectExact(ranked, target, rng);
  if (!picked) return failure(eligible, target, req.mode);
  const dn = difficultyNotice(picked, req.difficulty);
  if (dn) notices.push(dn);
  const composition = compositionOf(picked);
  if (req.mode === "PYQ_PRIORITY" && composition.VERIFIED_PYQ.marks < target) {
    const verifiedAvailable = eligible.filter((q) => q.sourceType === "VERIFIED_PYQ").reduce((s, q) => s + q.marks, 0);
    notices.push(
      verifiedAvailable === 0
        ? "No verified previous-year questions are available for this selection, so the paper uses other labelled questions."
        : `Verified PYQs make up ${composition.VERIFIED_PYQ.marks} of ${target} marks. The rest are labelled non-PYQ questions.`,
    );
  }
  return {
    ok: true,
    selected: orderForPaper(picked).map((q) => ({ questionId: q.id, marks: q.marks, section: "" })),
    totalMarks: target,
    composition,
    notices,
  };
}

export type Estimate = {
  eligibleCount: number;
  eligibleMarks: number;
  byTier: Composition;
  /** Composition of a trial generation, or null when the request can't be met. */
  projected: Composition | null;
  failure: GenerateFailure | null;
};

export function estimatePaper(pool: PoolQuestion[], req: Omit<GenerateRequest, "seed">): Estimate {
  const eligible = eligiblePool(pool, req.mode);
  const byTier = compositionOf(eligible);
  const trial = generatePaper(pool, { ...req, seed: 12345 });
  return {
    eligibleCount: eligible.length,
    eligibleMarks: eligible.reduce((s, q) => s + q.marks, 0),
    byTier,
    projected: trial.ok ? trial.composition : null,
    failure: trial.ok ? null : trial,
  };
}

/** Suggested time for a paper, based on the ICSE convention of 80 marks in 2 hours (1.5 minutes per mark). */
export function suggestedMinutes(marks: number): number {
  return Math.max(10, Math.round((marks * 1.5) / 5) * 5);
}
