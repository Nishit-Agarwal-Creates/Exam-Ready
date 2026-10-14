import assert from "node:assert/strict";
import { test } from "node:test";
import { paperEligibility, gradingModeOf } from "../src/lib/engine/eligibility.ts";
import { generatePaper, isMarkable, type PoolQuestion } from "../src/lib/engine/generator.ts";
import { canAutoGrade, evaluate, validKey } from "../src/lib/engine/grading.ts";
import { gradeSubmission, itemScore, summarise, type GradedItem } from "../src/lib/engine/scoring.ts";

// ── Grading by question type ──────────────────────────────────────────────

test("MCQ / assertion–reason: only the chosen option index counts; free text and out-of-range picks are wrong", () => {
  const key = { correctOption: 2 };
  assert.deepEqual(evaluate("MCQ", key, 1, "2", 4), { isCorrect: true, marksAwarded: 1, method: "AUTO" });
  assert.equal(evaluate("MCQ", key, 1, "1", 4).marksAwarded, 0);
  assert.equal(evaluate("MCQ", key, 1, "c", 4).isCorrect, false);
  assert.equal(evaluate("MCQ", key, 1, "2.0", 4).isCorrect, false);
  assert.equal(evaluate("ASSERTION_REASON", { correctOption: 0 }, 1, "0", 4).isCorrect, true);
});

test("an answer key that points outside the options is not a key: nothing is auto-marked", () => {
  assert.equal(validKey("MCQ", { correctOption: 4 }, 4), false);
  assert.equal(validKey("MCQ", { correctOption: -1 }, 4), false);
  assert.deepEqual(evaluate("MCQ", { correctOption: 5 }, 2, "1", 4), { isCorrect: null, marksAwarded: null, method: "NONE" });
  assert.equal(canAutoGrade("MCQ", { correctOption: 3 }, 4), true);
});

test("fill in the blank: case, spacing, punctuation and subscripts are ignored; any listed alternative counts", () => {
  const key = { accepted: ["Xylem", "xylem vessels"] };
  assert.equal(evaluate("FILL_BLANK", key, 1, "  XYLEM. ").isCorrect, true);
  assert.equal(evaluate("FILL_BLANK", key, 1, "xylem   vessels").isCorrect, true);
  assert.equal(evaluate("FILL_BLANK", key, 1, "phloem").isCorrect, false);
  assert.equal(evaluate("FILL_BLANK", { accepted: ["H₂O"] }, 1, "h2o").isCorrect, true);
  // An empty accepted list is not a key.
  assert.equal(evaluate("FILL_BLANK", { accepted: ["", "  "] }, 1, "anything").method, "NONE");
});

test("numerical: stated tolerance, exact when none; same or no unit accepted, a different unit is wrong", () => {
  assert.equal(evaluate("NUMERICAL", { value: 12.5, tolerance: 0 }, 2, "12.5").isCorrect, true);
  assert.equal(evaluate("NUMERICAL", { value: 12.5, tolerance: 0 }, 2, "12.6").isCorrect, false);
  assert.equal(evaluate("NUMERICAL", { value: 12.5, tolerance: 0.1 }, 2, "12.6").isCorrect, true);
  assert.equal(evaluate("NUMERICAL", { value: 0.75, tolerance: 0 }, 2, "3/4").isCorrect, true);
  assert.equal(evaluate("NUMERICAL", { value: 12.5, tolerance: 0, unit: "cm" }, 2, "12.5 cm").isCorrect, true);
  assert.equal(evaluate("NUMERICAL", { value: 12.5, tolerance: 0, unit: "cm" }, 2, "12.5 m").isCorrect, false);
  assert.equal(evaluate("NUMERICAL", { value: 12.5, tolerance: 0 }, 2, "12.5 cm").isCorrect, true);
  assert.equal(evaluate("NUMERICAL", { value: 12.5, tolerance: 0 }, 2, "about twelve").isCorrect, false);
  assert.equal(validKey("NUMERICAL", { value: Number.NaN, tolerance: 0 }), false);
  assert.equal(validKey("NUMERICAL", { value: 3, tolerance: -1 }), false);
});

test("descriptive questions and missing keys are never auto-marked or given full marks", () => {
  assert.deepEqual(evaluate("SHORT_ANSWER", null, 3, "anything"), { isCorrect: null, marksAwarded: null, method: "NONE" });
  assert.deepEqual(evaluate("MCQ", null, 1, "0", 4), { isCorrect: null, marksAwarded: null, method: "NONE" });
  assert.deepEqual(evaluate("LONG_ANSWER", { accepted: ["x"] }, 5, "x"), { isCorrect: null, marksAwarded: null, method: "NONE" });
});

test("unanswered auto questions score 0, wrong answers 0 (no negative marking), right answers never exceed the marks", () => {
  assert.deepEqual(evaluate("MCQ", { correctOption: 0 }, 2, "", 4), { isCorrect: false, marksAwarded: 0, method: "AUTO" });
  assert.deepEqual(evaluate("MCQ", { correctOption: 0 }, 2, null, 4), { isCorrect: false, marksAwarded: 0, method: "AUTO" });
  assert.equal(evaluate("MCQ", { correctOption: 0 }, 2, "1", 4).marksAwarded, 0);
  assert.equal(evaluate("MCQ", { correctOption: 0 }, 2, "0", 4).marksAwarded, 2);
});

// ── Eligibility for generated papers ──────────────────────────────────────

test("eligibility: a question needs a printed positive mark and something to mark the answer against", () => {
  const base = { type: "SHORT_ANSWER", marks: 3, marksStatus: "PRINTED", options: null, answerKey: null, hasModelAnswer: true };
  assert.deepEqual(paperEligibility(base), { eligible: true, mode: "SELF_REVIEW", reasons: [] });
  const noAnswer = paperEligibility({ ...base, hasModelAnswer: false });
  assert.equal(noAnswer.eligible, false);
  assert.match(noAnswer.reasons.join(" "), /no answer key or official model answer/);
  assert.equal(paperEligibility({ ...base, marks: 0 }).eligible, false);
  assert.equal(paperEligibility({ ...base, marks: null }).eligible, false);
  assert.equal(paperEligibility({ ...base, marks: 1.5 }).eligible, false);
  assert.match(paperEligibility({ ...base, marks: 0, marksStatus: "GROUP_TOTAL" }).reasons[0], /total for its whole group/);
  assert.match(paperEligibility({ ...base, marks: 0, marksStatus: "NOT_PRINTED" }).reasons[0], /prints no mark/);
  assert.equal(paperEligibility({ ...base, type: "ESSAY" }).eligible, false);
});

test("eligibility: choice questions need their options; a key into them makes the question auto-marked", () => {
  const mcq = { type: "MCQ", marks: 1, marksStatus: "PRINTED", options: ["a", "b", "c", "d"], answerKey: { correctOption: 1 }, hasModelAnswer: false };
  assert.deepEqual(paperEligibility(mcq), { eligible: true, mode: "AUTO", reasons: [] });
  assert.equal(paperEligibility({ ...mcq, options: null }).eligible, false);
  assert.match(paperEligibility({ ...mcq, answerKey: { correctOption: 7 } }).reasons.join(" "), /doesn't exist/);
  // No key but an official model answer: the student can still mark it.
  assert.equal(paperEligibility({ ...mcq, answerKey: null, hasModelAnswer: true }).mode, "SELF_REVIEW");
  assert.equal(paperEligibility({ ...mcq, answerKey: null, hasModelAnswer: false }).eligible, false);
  assert.equal(gradingModeOf({ type: "FILL_BLANK", answerKey: { accepted: ["xylem"] }, hasModelAnswer: false }), "AUTO");
});

// ── Paper generation ──────────────────────────────────────────────────────

let nextId = 1000;
function pq(partial: Partial<PoolQuestion>): PoolQuestion {
  const id = nextId++;
  return {
    id,
    chapterId: 1,
    topicId: null,
    questionType: "SHORT_ANSWER",
    marks: 2,
    difficulty: "UNRATED",
    sourceType: "VERIFIED_PYQ",
    verificationStatus: "VERIFIED",
    isPublished: true,
    isDemo: false,
    isRealPyq: true,
    year: 2025,
    groupId: id,
    groupYears: 1,
    markable: true,
    ...partial,
  };
}

test("questions that can't be marked never enter a generated paper", () => {
  const good = Array.from({ length: 6 }, () => pq({}));
  const bad = [pq({ markable: false }), pq({ markable: false }), pq({ marks: 0 }), pq({ marks: -2 })];
  const badIds = new Set(bad.map((b) => b.id));
  assert.equal(isMarkable(pq({ markable: false })), false);
  assert.equal(isMarkable(pq({ marks: 0 })), false);
  for (let seed = 1; seed <= 20; seed++) {
    const r = generatePaper([...good, ...bad], { mode: "PYQ_ONLY", totalMarks: 10, difficulty: "MIXED", seed });
    assert.ok(r.ok);
    if (!r.ok) continue;
    assert.ok(r.selected.every((s) => !badIds.has(s.questionId)));
    // The paper total is exactly the sum of its questions' marks.
    assert.equal(r.selected.reduce((s, x) => s + x.marks, 0), r.totalMarks);
    assert.ok(r.stages.some((st) => st.key === "markable" && /4 left out/.test(st.detail)));
  }
});

test("too few markable questions: a clear explanation instead of an invalid paper, nothing padded", () => {
  const pool = [pq({}), pq({}), pq({ markable: false }), pq({ markable: false }), pq({ markable: false })];
  const r = generatePaper(pool, { mode: "PYQ_ONLY", totalMarks: 20, difficulty: "MIXED", seed: 7 });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.reason, "INSUFFICIENT");
  assert.equal(r.maxAchievableMarks, 4);
  assert.match(r.message, /3 more questions are in this selection but can't be used in a test/);
  const none = generatePaper([pq({ markable: false })], { mode: "PRACTICE", totalMarks: 5, difficulty: "MIXED", seed: 1 });
  assert.equal(none.ok, false);
  if (!none.ok) {
    assert.equal(none.reason, "NO_QUESTIONS");
    assert.match(none.message, /None of the 1 question in this selection can be used in a test yet/);
    assert.doesNotMatch(none.message, /no reviewed questions/);
  }
});

// ── Submission, results and totals ────────────────────────────────────────

const ITEMS: GradedItem[] = [
  { position: 1, marks: 1, question: { id: 11, type: "MCQ", options: ["a", "b", "c", "d"], answer: { key: { correctOption: 2 } } } },
  { position: 2, marks: 2, question: { id: 12, type: "FILL_BLANK", options: null, answer: { key: { accepted: ["xylem"] } } } },
  { position: 3, marks: 3, question: { id: 13, type: "SHORT_ANSWER", options: null, answer: { key: null } } },
  { position: 4, marks: 4, question: { id: 14, type: "LONG_ANSWER", options: null, answer: { key: null } } },
];

test("submission: one row per paper question, max = sum of marks, correct/incorrect/unanswered/pending handled", () => {
  const g = gradeSubmission(ITEMS, [
    { questionId: 11, response: "2" },
    { questionId: 12, response: "Phloem" },
    { questionId: 13, response: "Because of osmosis." },
    { questionId: 99, response: "not in this paper" },
  ]);
  assert.equal(g.rows.length, 4);
  assert.equal(g.maxScore, 10);
  assert.equal(g.autoScore, 1);
  assert.deepEqual(
    g.rows.map((r) => [r.questionId, r.evaluationMethod, r.marksAwarded, r.isCorrect]),
    [
      [11, "AUTO", 1, true],
      [12, "AUTO", 0, false],
      [13, "NONE", null, null],
      [14, "NONE", null, null],
    ],
  );
  // A written answer waits for marking, so the self-marked score isn't final yet.
  assert.equal(g.selfScore, null);
  // Nothing written: nothing waits.
  assert.equal(gradeSubmission(ITEMS, [{ questionId: 11, response: "2" }]).selfScore, 0);
});

test("re-sending the same answers gives the same marks (a refresh or retry can't add marks)", () => {
  const answers = [
    { questionId: 11, response: "2" },
    { questionId: 12, response: "xylem" },
    { questionId: 11, response: "2" },
  ];
  const a = gradeSubmission(ITEMS, answers);
  const b = gradeSubmission(ITEMS, answers);
  assert.deepEqual(a, b);
  assert.equal(a.autoScore, 3);
  assert.ok(a.autoScore <= a.maxScore);
});

test("results use the method stored at submission: a key added later never turns a waiting answer into 0", () => {
  const nowKeyed = { type: "MCQ" as const, options: ["a", "b"], answer: { key: { correctOption: 0 } } };
  // Submitted when there was no key: stored NONE, waiting for the student's marks.
  assert.deepEqual(itemScore(2, { response: "1", evaluationMethod: "NONE", marksAwarded: null }, nowKeyed), { auto: false, answered: true, scored: null });
  // Self-marked later.
  assert.deepEqual(itemScore(2, { response: "1", evaluationMethod: "SELF", marksAwarded: 1.5 }, nowKeyed), { auto: false, answered: true, scored: 1.5 });
  // Marks outside 0..max are clamped.
  assert.equal(itemScore(2, { response: "1", evaluationMethod: "SELF", marksAwarded: 9 }, nowKeyed).scored, 2);
  assert.equal(itemScore(2, { response: "0", evaluationMethod: "AUTO", marksAwarded: -3 }, nowKeyed).scored, 0);
  // Unanswered written questions score 0 and never wait.
  assert.deepEqual(itemScore(3, { response: null, evaluationMethod: "NONE", marksAwarded: null }, { type: "SHORT_ANSWER" }), { auto: false, answered: false, scored: 0 });
});

test("totals: provisional while answers wait, final and consistent percentage once marked", () => {
  const pending = summarise([
    { marks: 1, scored: 1 },
    { marks: 2, scored: 0 },
    { marks: 3, scored: null },
  ]);
  assert.deepEqual(pending, { scored: 1, evaluatedMax: 3, max: 6, pending: 1, final: false, percent: 33 });
  const done = summarise([
    { marks: 1, scored: 1 },
    { marks: 2, scored: 0 },
    { marks: 3, scored: 2.5 },
  ]);
  assert.deepEqual(done, { scored: 3.5, evaluatedMax: 6, max: 6, pending: 0, final: true, percent: 58 });
  assert.equal(summarise([{ marks: 4, scored: null }]).percent, null);
  assert.equal(summarise([]).max, 0);
});
