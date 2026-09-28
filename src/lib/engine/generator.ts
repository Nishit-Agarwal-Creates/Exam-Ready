/**
 * Paper generation engine. Pure functions only (no database access), so it can be unit tested.
 *
 * Guarantees:
 *  - PYQ-based modes only use real verified PYQs (isRealPyq). If there aren't enough, they fail
 *    with the largest achievable total instead of padding the paper.
 *  - Non-PYQ material is only added when the mode includes it or the student explicitly allows it.
 *  - At most one question per duplicate group is used, so a question repeated across sets appears once.
 *  - The returned composition and stage log describe what was actually selected and done.
 */
import type { Difficulty, PaperMode, QuestionType, SourceType } from "@/db/schema";

export type PoolQuestion = {
  id: number;
  chapterId: number;
  topicId: number | null;
  questionType: QuestionType;
  marks: number;
  difficulty: Difficulty | "UNRATED";
  sourceType: SourceType;
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "REJECTED";
  isPublished: boolean;
  isDemo: boolean;
  /** Passes isRealVerifiedPyq (computed by the data layer from stored links). */
  isRealPyq: boolean;
  /** Most recent verified board-exam year, if any. */
  year: number | null;
  /** Canonical question id (the question's own id when it has no duplicates). */
  groupId: number;
  /** Distinct verified exam years across the duplicate group. */
  groupYears: number;
};

export type DifficultyPref = "MIXED" | Difficulty;

export type GenerateRequest = {
  mode: PaperMode;
  totalMarks: number;
  difficulty: DifficultyPref;
  seed: number;
  /** PYQ priority / exam simulation: allow clearly labelled non-PYQ questions to fill gaps. */
  allowSupplement?: boolean;
};

export type Selected = { questionId: number; marks: number; section: string };

export type CompositionKey = SourceType;
export type Composition = Record<CompositionKey, { count: number; marks: number }>;

export type Stage = { key: string; label: string; detail: string };

export type GenerateSuccess = {
  ok: true;
  selected: Selected[];
  totalMarks: number;
  composition: Composition;
  notices: string[];
  stages: Stage[];
};

export type GenerateFailure = {
  ok: false;
  reason: "NO_QUESTIONS" | "INSUFFICIENT" | "NO_REPEATS";
  message: string;
  /** Largest total ≤ requested that the eligible pool can make exactly (0 if none). */
  maxAchievableMarks: number;
  availableMarks: number;
  stages: Stage[];
};

export type GenerateResult = GenerateSuccess | GenerateFailure;

export const MODE_LABELS: Record<PaperMode, { name: string; description: string; pyqOnly: boolean }> = {
  PYQ_ONLY: {
    name: "PYQ only",
    description: "Only verified previous-year questions. If there aren't enough, you're told how many exist. Nothing is added to fill the gap.",
    pyqOnly: true,
  },
  PYQ_PRIORITY: {
    name: "PYQ priority",
    description: "Verified PYQs first. Other labelled questions fill gaps only if you allow it below.",
    pyqOnly: false,
  },
  EXAM_SIMULATION: {
    name: "Exam simulation",
    description: "Board-style structure: Section A short questions, Section B longer ones, timed like the real paper.",
    pyqOnly: false,
  },
  RECENT_PYQ: {
    name: "Recent PYQs",
    description: "Verified PYQs from the most recent exam years first.",
    pyqOnly: true,
  },
  MOST_REPEATED: {
    name: "Most repeated PYQs",
    description: "Verified questions that appeared in more than one exam year, most frequent first.",
    pyqOnly: true,
  },
  PYQ_PLUS_OFFICIAL: {
    name: "PYQ + official sample",
    description: "Verified PYQs and official sample questions, each labelled separately.",
    pyqOnly: false,
  },
  PRACTICE: {
    name: "Practice mix",
    description: "Everything available: PYQs, official samples, community and AI practice questions, all labelled.",
    pyqOnly: false,
  },
  AI_SUPPLEMENTARY: {
    name: "AI practice",
    description: "Only AI-generated practice questions. None of them have appeared in an exam.",
    pyqOnly: false,
  },
};

export function emptyComposition(): Composition {
  return {
    VERIFIED_PYQ: { count: 0, marks: 0 },
    OFFICIAL_SAMPLE: { count: 0, marks: 0 },
    USER_CONTRIBUTED: { count: 0, marks: 0 },
    AI_SUPPLEMENTARY: { count: 0, marks: 0 },
    PENDING_REVIEW: { count: 0, marks: 0 },
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

type Category = "PYQ" | "OFFICIAL" | "COMMUNITY" | "AI";

/** Which category a question counts as for paper building. Unreviewed/rejected/unpublished questions have none. */
export function categoryOf(q: PoolQuestion): Category | null {
  if (!q.isPublished || q.verificationStatus === "REJECTED") return null;
  if (q.isRealPyq) return "PYQ";
  if (q.sourceType === "OFFICIAL_SAMPLE" && q.verificationStatus === "VERIFIED") return "OFFICIAL";
  if (q.sourceType === "USER_CONTRIBUTED" && q.verificationStatus === "VERIFIED") return "COMMUNITY";
  // AI practice is usable once published; it is always labelled and never counted as a PYQ.
  if (q.sourceType === "AI_SUPPLEMENTARY") return "AI";
  return null;
}

/** Categories a mode may draw from, in priority order. */
export function modeCategories(mode: PaperMode, allowSupplement = false): Category[] {
  switch (mode) {
    case "PYQ_ONLY":
    case "RECENT_PYQ":
    case "MOST_REPEATED":
      return ["PYQ"];
    case "PYQ_PRIORITY":
    case "EXAM_SIMULATION":
      return allowSupplement ? ["PYQ", "OFFICIAL", "COMMUNITY", "AI"] : ["PYQ"];
    case "PYQ_PLUS_OFFICIAL":
      return ["PYQ", "OFFICIAL"];
    case "PRACTICE":
      return ["PYQ", "OFFICIAL", "COMMUNITY", "AI"];
    case "AI_SUPPLEMENTARY":
      return ["AI"];
  }
}

export function eligiblePool(pool: PoolQuestion[], mode: PaperMode, allowSupplement = false): PoolQuestion[] {
  const cats = modeCategories(mode, allowSupplement);
  return pool.filter((q) => {
    const c = categoryOf(q);
    if (!c || !cats.includes(c)) return false;
    if (mode === "MOST_REPEATED") return q.groupYears >= 2;
    return true;
  });
}

/** Largest subset-sum ≤ target (0/1 knapsack on marks). */
export function maxAchievable(items: { marks: number }[], target: number): number {
  const reach = new Uint8Array(target + 1);
  reach[0] = 1;
  for (const it of items) for (let s = target; s >= it.marks; s--) if (reach[s - it.marks]) reach[s] = 1;
  for (let s = target; s >= 0; s--) if (reach[s]) return s;
  return 0;
}

function exactFill<T extends { marks: number }>(items: T[], target: number, cost: (t: T) => number): T[] | null {
  if (target === 0) return [];
  const INF = Number.POSITIVE_INFINITY;
  const best = new Array<number>(target + 1).fill(INF);
  const choice: number[][] = Array.from({ length: target + 1 }, () => []);
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

function tierFor(mode: PaperMode, q: PoolQuestion, cats: Category[], years: number[], maxRepeat: number): number {
  if (mode === "RECENT_PYQ") return Math.max(0, years.indexOf(q.year ?? -1));
  if (mode === "MOST_REPEATED") return maxRepeat - q.groupYears;
  return Math.max(0, cats.indexOf(categoryOf(q) as Category));
}

function rankItems(items: PoolQuestion[], req: GenerateRequest, rng: () => number): Ranked[] {
  const cats = modeCategories(req.mode, req.allowSupplement);
  const years = [...new Set(items.map((i) => i.year).filter((y): y is number => y !== null))].sort((a, b) => b - a);
  const maxRepeat = Math.max(0, ...items.map((i) => i.groupYears));
  return items.map((q) => ({
    ...q,
    tier: tierFor(req.mode, q, cats, years, maxRepeat),
    jitter: rng(),
    diffPenalty: req.difficulty === "MIXED" || q.difficulty === "UNRATED" || q.difficulty === req.difficulty ? 0 : 1,
  }));
}

/** Keeps the best-ranked question of each duplicate group. */
function dedupeGroups(items: Ranked[]): Ranked[] {
  const best = new Map<number, Ranked>();
  for (const it of items) {
    const cur = best.get(it.groupId);
    if (!cur || it.tier < cur.tier || (it.tier === cur.tier && (it.year ?? 0) > (cur.year ?? 0))) best.set(it.groupId, it);
  }
  return [...best.values()];
}

/** Round-robin across chapters within each tier so no single chapter dominates the paper. */
function interleave(items: Ranked[], rng: () => number): Ranked[] {
  const ordered: Ranked[] = [];
  const tiers = [...new Set(items.map((i) => i.tier))].sort((a, b) => a - b);
  for (const tier of tiers) {
    const byChapter = new Map<number, Ranked[]>();
    for (const it of items.filter((i) => i.tier === tier)) byChapter.set(it.chapterId, [...(byChapter.get(it.chapterId) ?? []), it]);
    const buckets = [...byChapter.values()].map((l) => l.sort((a, b) => a.diffPenalty - b.diffPenalty || a.jitter - b.jitter));
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

function selectExact(items: Ranked[], target: number, rng: () => number): Ranked[] | null {
  if (target <= 0) return [];
  if (items.reduce((s, i) => s + i.marks, 0) < target) return null;
  const ordered = interleave(items, rng);
  const picked: Ranked[] = [];
  let remaining = target;
  for (const it of ordered) {
    if (it.marks <= remaining) {
      picked.push(it);
      remaining -= it.marks;
      if (remaining === 0) return picked;
    }
  }
  const cost = (i: Ranked) => 1 + i.tier * 50 + i.diffPenalty * 5 + i.jitter;
  const fill = exactFill(
    ordered.filter((o) => !picked.includes(o)),
    remaining,
    cost,
  );
  if (fill) return [...picked, ...fill];
  const dropOrder = [...picked].sort((a, b) => b.tier - a.tier || b.jitter - a.jitter);
  for (const drop of dropOrder) {
    const kept = picked.filter((p) => p !== drop);
    const f = exactFill(
      ordered.filter((o) => !kept.includes(o)),
      remaining + drop.marks,
      cost,
    );
    if (f) return [...kept, ...f];
  }
  const lim = Math.min(dropOrder.length, 12);
  for (let i = 0; i < lim; i++) {
    for (let j = i + 1; j < lim; j++) {
      const kept = picked.filter((p) => p !== dropOrder[i] && p !== dropOrder[j]);
      const f = exactFill(
        ordered.filter((o) => !kept.includes(o)),
        remaining + dropOrder[i].marks + dropOrder[j].marks,
        cost,
      );
      if (f) return [...kept, ...f];
    }
  }
  return exactFill(ordered, target, cost);
}

const TYPE_ORDER: QuestionType[] = ["MCQ", "ASSERTION_REASON", "FILL_BLANK", "NUMERICAL", "SHORT_ANSWER", "LONG_ANSWER", "CASE_BASED"];

function orderForPaper(items: Ranked[]): Ranked[] {
  return [...items].sort(
    (a, b) => a.marks - b.marks || TYPE_ORDER.indexOf(a.questionType) - TYPE_ORDER.indexOf(b.questionType) || a.chapterId - b.chapterId,
  );
}

/** Composition keyed by what each question really is. Only real verified PYQs count as VERIFIED_PYQ. */
export function compositionOf(items: PoolQuestion[]): Composition {
  const c = emptyComposition();
  for (const q of items) {
    const key: CompositionKey = q.isRealPyq ? "VERIFIED_PYQ" : q.sourceType === "VERIFIED_PYQ" ? "PENDING_REVIEW" : q.sourceType;
    c[key].count++;
    c[key].marks += q.marks;
  }
  return c;
}

function difficultyNotice(items: PoolQuestion[], pref: DifficultyPref): string | null {
  if (pref === "MIXED") return null;
  const rated = items.filter((i) => i.difficulty !== "UNRATED");
  const total = items.reduce((s, i) => s + i.marks, 0);
  const matching = items.filter((i) => i.difficulty === pref).reduce((s, i) => s + i.marks, 0);
  if (rated.length < items.length) return "Difficulty isn't rated for board exam questions, so the difficulty setting only applies to practice questions.";
  if (total && matching / total < 0.6) {
    return `Only ${Math.round((matching / total) * 100)}% of the marks are ${pref.toLowerCase()} questions. There weren't enough of them, so others were added to reach the total.`;
  }
  return null;
}

function failureFor(eligible: PoolQuestion[], target: number, req: GenerateRequest, stages: Stage[]): GenerateFailure {
  const availableMarks = eligible.reduce((s, q) => s + q.marks, 0);
  const best = maxAchievable(eligible, target);
  const pyq = MODE_LABELS[req.mode].pyqOnly || (["PYQ_PRIORITY", "EXAM_SIMULATION"].includes(req.mode) && !req.allowSupplement);
  if (req.mode === "MOST_REPEATED" && eligible.length === 0) {
    return {
      ok: false,
      reason: "NO_REPEATS",
      message:
        "No verified question in this selection has appeared in more than one exam year yet, so there is nothing to call “most repeated”. Try Recent PYQs instead.",
      maxAchievableMarks: 0,
      availableMarks: 0,
      stages,
    };
  }
  if (eligible.length === 0) {
    return {
      ok: false,
      reason: "NO_QUESTIONS",
      message: pyq
        ? "No verified previous-year questions are available for this selection yet. Nothing will be made up to fill the gap."
        : req.mode === "AI_SUPPLEMENTARY"
          ? "There are no AI practice questions for this selection."
          : "There are no reviewed questions for this selection yet.",
      maxAchievableMarks: 0,
      availableMarks: 0,
      stages,
    };
  }
  return {
    ok: false,
    reason: "INSUFFICIENT",
    message: pyq
      ? `There aren't enough verified previous-year questions for a ${target}-mark paper. The verified questions available add up to ${availableMarks} marks, and the closest paper they can make is ${best} marks.`
      : `The questions available for this selection can make at most a ${best}-mark paper (${availableMarks} marks in total).`,
    maxAchievableMarks: best,
    availableMarks,
    stages,
  };
}

export function generatePaper(pool: PoolQuestion[], req: GenerateRequest): GenerateResult {
  const rng = mulberry32(req.seed);
  const target = req.totalMarks;
  const stages: Stage[] = [];
  const inScope = pool.filter((q) => q.isPublished && q.verificationStatus !== "REJECTED");
  stages.push({ key: "search", label: "Searched the question bank", detail: `${inScope.length} published questions in scope` });
  const eligible = eligiblePool(pool, req.mode, req.allowSupplement);
  const realPyq = eligible.filter((q) => q.isRealPyq).length;
  stages.push({
    key: "provenance",
    label: "Checked provenance",
    detail: `${eligible.length} eligible for ${MODE_LABELS[req.mode].name}${realPyq ? `, ${realPyq} of them verified PYQs` : ""}`,
  });
  const ranked = dedupeGroups(rankItems(eligible, req, rng));
  const removed = eligible.length - ranked.length;
  stages.push({ key: "duplicates", label: "Removed duplicates", detail: removed ? `${removed} repeat${removed === 1 ? "" : "s"} across sets skipped` : "No duplicates found" });
  const notices: string[] = [];

  let selected: Selected[];
  let chosen: Ranked[];
  if (req.mode === "EXAM_SIMULATION") {
    const short = ranked.filter((q) => q.marks <= 2);
    const long = ranked.filter((q) => q.marks >= 3);
    let a = selectExact(short, Math.round(target / 2), rng);
    let b = a ? selectExact(long, target - Math.round(target / 2), rng) : null;
    if (!a || !b) {
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
            notices.push(`Section A has ${tA} marks and Section B has ${tB}. An even split wasn't possible with the questions available.`);
            break;
          }
        }
      }
    }
    if (!a || !b) return failureFor(ranked, target, req, stages);
    chosen = [...a, ...b];
    selected = [
      ...orderForPaper(a).map((q) => ({ questionId: q.id, marks: q.marks, section: "A" })),
      ...orderForPaper(b).map((q) => ({ questionId: q.id, marks: q.marks, section: "B" })),
    ];
  } else {
    const picked = selectExact(ranked, target, rng);
    if (!picked) return failureFor(ranked, target, req, stages);
    chosen = picked;
    selected = orderForPaper(picked).map((q) => ({ questionId: q.id, marks: q.marks, section: "" }));
  }
  stages.push({ key: "balance", label: "Balanced marks", detail: `${target} of ${target} marks from ${chosen.length} questions` });
  const composition = compositionOf(chosen);
  const dn = difficultyNotice(chosen, req.difficulty);
  if (dn) notices.push(dn);
  if ((req.mode === "PYQ_PRIORITY" || req.mode === "EXAM_SIMULATION") && composition.VERIFIED_PYQ.marks < target) {
    notices.push(`Verified PYQs make up ${composition.VERIFIED_PYQ.marks} of ${target} marks. The rest are labelled non-PYQ questions.`);
  }
  stages.push({ key: "build", label: "Built the paper", detail: `${new Set(chosen.map((c) => c.chapterId)).size} chapters covered` });
  return { ok: true, selected, totalMarks: target, composition, notices, stages };
}

export type Estimate = {
  eligibleCount: number;
  eligibleMarks: number;
  byCategory: Composition;
  projected: Composition | null;
  failure: GenerateFailure | null;
};

export function estimatePaper(pool: PoolQuestion[], req: Omit<GenerateRequest, "seed">): Estimate {
  const eligible = eligiblePool(pool, req.mode, req.allowSupplement);
  const trial = generatePaper(pool, { ...req, seed: 12345 });
  return {
    eligibleCount: eligible.length,
    eligibleMarks: eligible.reduce((s, q) => s + q.marks, 0),
    byCategory: compositionOf(eligible),
    projected: trial.ok ? trial.composition : null,
    failure: trial.ok ? null : trial,
  };
}

/** Suggested time: board papers are typically 80 marks in 2–3 hours; 1.5 minutes a mark is a fair default. */
export function suggestedMinutes(marks: number): number {
  return Math.max(10, Math.round((marks * 1.5) / 5) * 5);
}
