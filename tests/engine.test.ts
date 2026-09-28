import assert from "node:assert/strict";
import { test } from "node:test";
import { coverageOf } from "../src/lib/engine/coverage.ts";
import { categoryOf, compositionOf, estimatePaper, generatePaper, maxAchievable, type PoolQuestion } from "../src/lib/engine/generator.ts";
import { canAutoGrade, evaluate, parseNumber } from "../src/lib/engine/grading.ts";

let nextId = 1;
function q(partial: Partial<PoolQuestion>): PoolQuestion {
  const id = nextId++;
  const sourceType = partial.sourceType ?? "VERIFIED_PYQ";
  return {
    id,
    chapterId: 1,
    topicId: null,
    questionType: "SHORT_ANSWER",
    marks: 2,
    difficulty: "UNRATED",
    sourceType,
    verificationStatus: "VERIFIED",
    isPublished: true,
    isDemo: false,
    isRealPyq: sourceType === "VERIFIED_PYQ",
    year: sourceType === "VERIFIED_PYQ" ? 2025 : null,
    groupId: id,
    groupYears: sourceType === "VERIFIED_PYQ" ? 1 : 0,
    ...partial,
  };
}

function bank(): PoolQuestion[] {
  nextId = 1;
  const out: PoolQuestion[] = [];
  for (let c = 1; c <= 3; c++) {
    for (const m of [1, 1, 1, 2, 2, 3, 4]) out.push(q({ chapterId: c, marks: m, questionType: m === 1 ? "MCQ" : m >= 4 ? "LONG_ANSWER" : "SHORT_ANSWER" }));
  }
  // 3 × 14 = 42 marks of verified PYQs, plus other sources
  for (let i = 0; i < 6; i++) out.push(q({ chapterId: 1 + (i % 3), marks: 2, sourceType: "OFFICIAL_SAMPLE" }));
  for (let i = 0; i < 6; i++) out.push(q({ chapterId: 1 + (i % 3), marks: 3, sourceType: "AI_SUPPLEMENTARY", verificationStatus: "UNVERIFIED" }));
  out.push(q({ marks: 5, sourceType: "USER_CONTRIBUTED", verificationStatus: "UNVERIFIED" }));
  // Extracted PYQ candidates awaiting review: never usable in PYQ modes
  for (let i = 0; i < 4; i++) out.push(q({ marks: 4, verificationStatus: "UNVERIFIED", isRealPyq: false, isPublished: false }));
  return out;
}

const sum = (xs: { marks: number }[]) => xs.reduce((s, x) => s + x.marks, 0);

test("PYQ_ONLY hits the exact total using only real verified PYQs", () => {
  const pool = bank();
  const res = generatePaper(pool, { mode: "PYQ_ONLY", totalMarks: 30, difficulty: "MIXED", seed: 7 });
  assert.ok(res.ok);
  assert.equal(sum(res.selected), 30);
  const byId = new Map(pool.map((p) => [p.id, p]));
  for (const s of res.selected) assert.equal(byId.get(s.questionId)!.isRealPyq, true);
  assert.equal(res.composition.VERIFIED_PYQ.marks, 30);
  assert.ok(res.stages.some((s) => s.key === "provenance"));
});

test("PYQ_ONLY refuses to pad when verified questions run out", () => {
  const res = generatePaper(bank(), { mode: "PYQ_ONLY", totalMarks: 60, difficulty: "MIXED", seed: 1 });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, "INSUFFICIENT");
    assert.equal(res.availableMarks, 42);
    assert.equal(res.maxAchievableMarks, 42);
  }
});

test("PYQ_PRIORITY only fills gaps with non-PYQ questions when the student allows it", () => {
  const without = generatePaper(bank(), { mode: "PYQ_PRIORITY", totalMarks: 50, difficulty: "MIXED", seed: 3 });
  assert.equal(without.ok, false);
  const withFill = generatePaper(bank(), { mode: "PYQ_PRIORITY", totalMarks: 50, difficulty: "MIXED", seed: 3, allowSupplement: true });
  assert.ok(withFill.ok);
  assert.equal(sum(withFill.selected), 50);
  assert.equal(withFill.composition.VERIFIED_PYQ.marks, 42);
  assert.equal(withFill.composition.USER_CONTRIBUTED.count, 0, "unreviewed contributed questions are never used");
  assert.equal(withFill.composition.PENDING_REVIEW.count, 0, "unverified PYQ candidates are never used");
});

test("AI questions can never count as PYQs, whatever their stored status", () => {
  nextId = 100;
  const ai = q({ sourceType: "AI_SUPPLEMENTARY", verificationStatus: "VERIFIED", isRealPyq: false });
  assert.equal(categoryOf(ai), "AI");
  const c = compositionOf([ai, q({})]);
  assert.equal(c.VERIFIED_PYQ.count, 1);
  assert.equal(c.AI_SUPPLEMENTARY.count, 1);
  const res = generatePaper([ai], { mode: "PYQ_ONLY", totalMarks: 2, difficulty: "MIXED", seed: 1 });
  assert.equal(res.ok, false);
});

test("an unverified PYQ candidate shows as pending review, not as a PYQ", () => {
  nextId = 200;
  const pending = q({ verificationStatus: "UNVERIFIED", isRealPyq: false });
  assert.equal(categoryOf({ ...pending, isPublished: true }), null);
  assert.equal(compositionOf([pending]).PENDING_REVIEW.count, 1);
  assert.equal(compositionOf([pending]).VERIFIED_PYQ.count, 0);
});

test("duplicates across sets are used once and don't inflate counts", () => {
  nextId = 300;
  const a = q({ marks: 3 });
  const b = q({ marks: 3, groupId: a.id }); // same question in another set
  const c = q({ marks: 2 });
  const res = generatePaper([a, b, c], { mode: "PYQ_ONLY", totalMarks: 5, difficulty: "MIXED", seed: 9 });
  assert.ok(res.ok);
  const ids = res.selected.map((s) => s.questionId);
  assert.ok(!(ids.includes(a.id) && ids.includes(b.id)));
  const impossible = generatePaper([a, b], { mode: "PYQ_ONLY", totalMarks: 6, difficulty: "MIXED", seed: 9 });
  assert.equal(impossible.ok, false, "two copies of one question can't make a 6-mark paper");
  const cov = coverageOf([a, b, c]);
  assert.equal(cov.verifiedPyqs, 2, "duplicate group counted once");
});

test("MOST_REPEATED needs questions asked in 2+ exam years", () => {
  nextId = 400;
  const none = generatePaper([q({}), q({})], { mode: "MOST_REPEATED", totalMarks: 2, difficulty: "MIXED", seed: 1 });
  assert.equal(none.ok, false);
  if (!none.ok) assert.equal(none.reason, "NO_REPEATS");
  const repeated = q({ marks: 2, groupYears: 3 });
  const once = q({ marks: 2, groupYears: 1 });
  const res = generatePaper([repeated, once], { mode: "MOST_REPEATED", totalMarks: 2, difficulty: "MIXED", seed: 1 });
  assert.ok(res.ok);
  assert.deepEqual(res.selected.map((s) => s.questionId), [repeated.id]);
});

test("RECENT_PYQ prefers the most recent exam year", () => {
  nextId = 500;
  const old = q({ year: 2022, marks: 2 });
  const recent = q({ year: 2026, marks: 2 });
  const res = generatePaper([old, recent], { mode: "RECENT_PYQ", totalMarks: 2, difficulty: "MIXED", seed: 4 });
  assert.ok(res.ok);
  assert.deepEqual(res.selected.map((s) => s.questionId), [recent.id]);
});

test("AI_SUPPLEMENTARY mode uses only AI practice questions", () => {
  const res = generatePaper(bank(), { mode: "AI_SUPPLEMENTARY", totalMarks: 9, difficulty: "MIXED", seed: 2 });
  assert.ok(res.ok);
  assert.equal(res.composition.AI_SUPPLEMENTARY.marks, 9);
  assert.equal(res.composition.VERIFIED_PYQ.marks, 0);
});

test("EXAM_SIMULATION splits into sections A (≤2 marks) and B (≥3 marks)", () => {
  const res = generatePaper(bank(), { mode: "EXAM_SIMULATION", totalMarks: 40, difficulty: "MIXED", seed: 11 });
  assert.ok(res.ok);
  assert.equal(sum(res.selected), 40);
  for (const s of res.selected) {
    if (s.section === "A") assert.ok(s.marks <= 2);
    else assert.ok(s.marks >= 3);
  }
});

test("generation is deterministic per seed and never repeats a question", () => {
  const pool = bank();
  const a = generatePaper(pool, { mode: "PRACTICE", totalMarks: 45, difficulty: "HARD", seed: 99 });
  const b = generatePaper(pool, { mode: "PRACTICE", totalMarks: 45, difficulty: "HARD", seed: 99 });
  assert.ok(a.ok && b.ok);
  const ids = a.selected.map((s) => s.questionId);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, b.selected.map((s) => s.questionId));
});

test("coverage: AI and demo questions never inflate PYQ counts; missing years aren't invented", () => {
  nextId = 600;
  const cov = coverageOf([
    q({ year: 2026 }),
    q({ year: 2026, verificationStatus: "UNVERIFIED", isRealPyq: false, isPublished: false }),
    q({ year: 2025 }),
    q({ sourceType: "AI_SUPPLEMENTARY", verificationStatus: "VERIFIED", isRealPyq: false }),
    q({ year: 2024, isDemo: true, isRealPyq: false }),
    q({ year: null }),
  ]);
  assert.equal(cov.verifiedPyqs, 2);
  assert.equal(cov.pendingPyqs, 1);
  assert.deepEqual(
    cov.byYear.map((y) => y.year),
    [2026, 2025],
  );
});

test("estimate reports eligible marks and projected composition", () => {
  const est = estimatePaper(bank(), { mode: "PYQ_ONLY", totalMarks: 20, difficulty: "MIXED" });
  assert.equal(est.eligibleMarks, 42);
  assert.equal(est.projected?.VERIFIED_PYQ.marks, 20);
});

test("maxAchievable finds best subset sum", () => {
  assert.equal(maxAchievable([{ marks: 4 }, { marks: 4 }], 7), 4);
  assert.equal(maxAchievable([{ marks: 3 }, { marks: 4 }], 7), 7);
});

test("grading: objective types, missing answer keys, descriptive", () => {
  assert.deepEqual(evaluate("MCQ", { correctOption: 2 }, 1, "2"), { isCorrect: true, marksAwarded: 1, method: "AUTO" });
  assert.equal(evaluate("ASSERTION_REASON", { correctOption: 0 }, 1, "0").isCorrect, true);
  assert.equal(evaluate("MCQ", { correctOption: 2 }, 1, "1").isCorrect, false);
  assert.equal(evaluate("MCQ", { correctOption: 2 }, 1, "").marksAwarded, 0);
  // No official key: never auto-marked, never guessed
  assert.equal(evaluate("MCQ", null, 1, "2").method, "NONE");
  assert.equal(canAutoGrade("MCQ", null), false);
  assert.equal(evaluate("FILL_BLANK", { accepted: ["electrovalent", "ionic"] }, 1, "  Ionic ").isCorrect, true);
  assert.equal(evaluate("FILL_BLANK", { accepted: ["h2o"] }, 1, "H₂O").isCorrect, true);
  assert.equal(evaluate("NUMERICAL", { value: 12.5, tolerance: 0.1 }, 3, "12.46 cm").isCorrect, true);
  assert.equal(evaluate("NUMERICAL", { value: 12.5, tolerance: 0.1 }, 3, "13").isCorrect, false);
  assert.equal(evaluate("CASE_BASED", null, 4, "anything").isCorrect, null);
  assert.equal(parseNumber("1,200"), 1200);
  assert.equal(parseNumber("3/4"), 0.75);
});

test("pool filters: types, PYQ year range and figures", async () => {
  const { filterPool, describeFilters } = await import("../src/lib/engine/generator.ts");
  const pool = [
    q({ questionType: "MCQ", year: 2026 }),
    q({ questionType: "MCQ", year: 2023 }),
    q({ questionType: "LONG_ANSWER", year: 2025, hasFigure: true }),
    q({ sourceType: "AI_SUPPLEMENTARY", questionType: "MCQ" }),
  ];
  assert.equal(filterPool(pool, { types: ["MCQ"] }).length, 3);
  // The year range only constrains verified PYQs; AI practice has no year and is kept.
  assert.deepEqual(
    filterPool(pool, { yearFrom: 2024, yearTo: 2026 }).map((x) => x.year),
    [2026, 2025, null],
  );
  assert.equal(filterPool(pool, { excludeFigures: true }).length, 3);
  assert.equal(describeFilters({ yearFrom: 2024, yearTo: 2026, excludeFigures: true }, {}), "Filters: PYQs from 2024–2026; questions that need a figure left out.");
  assert.equal(describeFilters({}, {}), null);
});
