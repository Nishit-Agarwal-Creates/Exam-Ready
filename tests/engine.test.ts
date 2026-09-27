import assert from "node:assert/strict";
import { test } from "node:test";
import { estimatePaper, generatePaper, maxAchievable, type PoolQuestion } from "../src/lib/engine/generator.ts";
import { evaluate, parseNumber } from "../src/lib/engine/grading.ts";

let nextId = 1;
function q(partial: Partial<PoolQuestion>): PoolQuestion {
  return {
    id: nextId++,
    chapterId: 1,
    topicId: null,
    questionType: "SHORT_ANSWER",
    marks: 2,
    difficulty: "MEDIUM",
    sourceType: "VERIFIED_PYQ",
    verificationStatus: "VERIFIED",
    isPublished: true,
    isDemo: false,
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
  for (let i = 0; i < 6; i++) out.push(q({ chapterId: 1 + (i % 3), marks: 3, sourceType: "AI_SUPPLEMENTARY" }));
  out.push(q({ marks: 5, sourceType: "USER_CONTRIBUTED", verificationStatus: "UNVERIFIED" }));
  return out;
}

const sum = (xs: { marks: number }[]) => xs.reduce((s, x) => s + x.marks, 0);

test("PYQ_ONLY hits the exact total using only verified PYQs", () => {
  const pool = bank();
  const res = generatePaper(pool, { mode: "PYQ_ONLY", totalMarks: 30, difficulty: "MIXED", seed: 7 });
  assert.ok(res.ok);
  assert.equal(sum(res.selected), 30);
  const byId = new Map(pool.map((p) => [p.id, p]));
  for (const s of res.selected) assert.equal(byId.get(s.questionId)!.sourceType, "VERIFIED_PYQ");
  assert.equal(res.composition.VERIFIED_PYQ.marks, 30);
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

test("PYQ_ONLY with no verified questions says so", () => {
  const res = generatePaper([q({ sourceType: "AI_SUPPLEMENTARY" })], { mode: "PYQ_ONLY", totalMarks: 10, difficulty: "MIXED", seed: 1 });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, "NO_QUESTIONS");
});

test("PYQ_PRIORITY uses every PYQ mark it can before other sources", () => {
  const res = generatePaper(bank(), { mode: "PYQ_PRIORITY", totalMarks: 50, difficulty: "MIXED", seed: 3 });
  assert.ok(res.ok);
  assert.equal(sum(res.selected), 50);
  assert.equal(res.composition.VERIFIED_PYQ.marks, 42);
  // Unverified questions are never used
  assert.equal(res.composition.USER_CONTRIBUTED.count, 0);
  assert.ok(res.notices.some((n) => n.includes("42 of 50")));
});

test("EXAM_SIMULATION splits into sections A (≤2 marks) and B (≥3 marks)", () => {
  const pool = bank();
  const res = generatePaper(pool, { mode: "EXAM_SIMULATION", totalMarks: 40, difficulty: "MIXED", seed: 11 });
  assert.ok(res.ok);
  assert.equal(sum(res.selected), 40);
  for (const s of res.selected) {
    if (s.section === "A") assert.ok(s.marks <= 2);
    else assert.ok(s.marks >= 3);
  }
});

test("no question appears twice and generation is deterministic per seed", () => {
  const pool = bank();
  const a = generatePaper(pool, { mode: "PYQ_PRIORITY", totalMarks: 45, difficulty: "HARD", seed: 99 });
  const b = generatePaper(pool, { mode: "PYQ_PRIORITY", totalMarks: 45, difficulty: "HARD", seed: 99 });
  assert.ok(a.ok && b.ok);
  const ids = a.selected.map((s) => s.questionId);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, b.selected.map((s) => s.questionId));
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

test("grading: MCQ, fill in the blank, numerical, descriptive", () => {
  assert.deepEqual(evaluate("MCQ", { correctOption: 2 }, 1, "2"), { isCorrect: true, marksAwarded: 1, method: "AUTO" });
  assert.equal(evaluate("MCQ", { correctOption: 2 }, 1, "1").isCorrect, false);
  assert.equal(evaluate("MCQ", { correctOption: 2 }, 1, "").marksAwarded, 0);
  assert.equal(evaluate("FILL_BLANK", { accepted: ["electrovalent", "ionic"] }, 1, "  Ionic ").isCorrect, true);
  assert.equal(evaluate("FILL_BLANK", { accepted: ["h2o"] }, 1, "H₂O").isCorrect, true);
  assert.equal(evaluate("NUMERICAL", { value: 12.5, tolerance: 0.1 }, 3, "12.46 cm").isCorrect, true);
  assert.equal(evaluate("NUMERICAL", { value: 12.5, tolerance: 0.1 }, 3, "13").isCorrect, false);
  assert.equal(evaluate("LONG_ANSWER", null, 4, "anything").isCorrect, null);
  assert.equal(parseNumber("1,200"), 1200);
  assert.equal(parseNumber("3/4"), 0.75);
});
