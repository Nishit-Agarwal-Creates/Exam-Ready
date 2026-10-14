import assert from "node:assert/strict";
import { test } from "node:test";
import { paperEligibility } from "../src/lib/engine/eligibility.ts";
import { generatePaper, type PoolQuestion } from "../src/lib/engine/generator.ts";
import { gradeSubmission, worksheetSummary } from "../src/lib/engine/scoring.ts";
import { generateWorksheet, marksLabel, practiceReasons, worksheetPool } from "../src/lib/engine/worksheet.ts";

let nextId = 5000;
function pq(partial: Partial<PoolQuestion>): PoolQuestion {
  const id = nextId++;
  return {
    id,
    chapterId: 1,
    topicId: null,
    questionType: "SHORT_ANSWER",
    marks: 2,
    difficulty: "UNRATED",
    sourceType: "USER_CONTRIBUTED",
    verificationStatus: "VERIFIED",
    isPublished: true,
    isDemo: false,
    isRealPyq: false,
    year: null,
    groupId: id,
    groupYears: 0,
    markable: false,
    practicable: true,
    hasAnswer: false,
    autoCheck: false,
    marksStatus: "PRINTED",
    ...partial,
  };
}

// An ICSE Class 6–9 style bank: reviewed school-paper questions, none with an answer key or model answer.
function schoolBank(): PoolQuestion[] {
  return [
    ...Array.from({ length: 12 }, (_, i) => pq({ chapterId: 1 + (i % 3) })),
    ...Array.from({ length: 6 }, () => pq({ marks: 0, marksStatus: "GROUP_TOTAL", questionType: "MCQ" })),
    pq({ questionType: "MCQ", practicable: false }), // options missing
  ];
}

test("ICSE 6–9 bank: no scored test is possible, but a practice worksheet is", () => {
  const bank = schoolBank();
  const scored = generatePaper(bank, { mode: "PRACTICE", totalMarks: 20, difficulty: "MIXED", seed: 3 });
  assert.equal(scored.ok, false);
  if (!scored.ok) assert.match(scored.message, /practice worksheet/);
  const ws = generateWorksheet(bank, { count: 10, seed: 3 });
  assert.equal(ws.ok, true);
  if (!ws.ok) return;
  assert.equal(ws.selected.length, 10);
  // Spread over the chapters, and questions without an answer are announced honestly.
  assert.ok(ws.notices.some((n) => /no published answer yet/.test(n)));
});

test("worksheets never invent marks: items without a printed mark carry 0 and the total counts printed marks only", () => {
  const bank = [pq({ marks: 3 }), pq({ marks: 2 }), pq({ marks: 0, marksStatus: "GROUP_TOTAL" }), pq({ marks: 0, marksStatus: "NOT_PRINTED" }), pq({ marks: 0, marksStatus: "FRACTIONAL" })];
  const ws = generateWorksheet(bank, { count: 5, seed: 1 });
  assert.ok(ws.ok);
  if (!ws.ok) return;
  assert.equal(ws.printedMarks, 5);
  assert.equal(ws.printedCount, 2);
  assert.equal(ws.selected.filter((s) => s.marks === 0).length, 3);
});

test("worksheets: one per duplicate group, the answered copy preferred, unpractisable and unreviewed questions left out", () => {
  const a = pq({});
  const b = pq({ groupId: a.groupId, hasAnswer: true });
  const bank = [a, b, pq({ practicable: false }), pq({ verificationStatus: "REJECTED" }), pq({ isPublished: false }), pq({ sourceType: "PENDING_REVIEW" })];
  const ws = generateWorksheet(bank, { count: 10, seed: 2 });
  assert.ok(ws.ok);
  if (!ws.ok) return;
  assert.deepEqual(
    ws.selected.map((s) => s.questionId),
    [b.id],
  );
  assert.ok(ws.notices.some((n) => /only 1 question/i.test(n)));
});

test("worksheets: AI practice only when chosen; nothing practisable gives a clear explanation", () => {
  const ai = pq({ sourceType: "AI_SUPPLEMENTARY", isDemo: true });
  assert.equal(worksheetPool([ai]).length, 0);
  assert.equal(worksheetPool([ai], true).length, 1);
  const none = generateWorksheet([pq({ practicable: false })], { count: 10, seed: 1 });
  assert.equal(none.ok, false);
  if (!none.ok) assert.match(none.message, /can be practised yet/);
});

test("practice eligibility: options are needed for choice questions; answers and marks are not", () => {
  assert.deepEqual(practiceReasons({ type: "SHORT_ANSWER", text: "Define osmosis." }), []);
  assert.equal(practiceReasons({ type: "MCQ", options: ["a", ""] }).length, 1);
  assert.equal(practiceReasons({ type: "ESSAY" }).length, 1);
  assert.equal(practiceReasons({ type: "FILL_BLANK", text: "  " }).length, 1);
});

test("marks labels: printed, group total, fraction, labelled practice suggestion, or not printed", () => {
  assert.equal(marksLabel({ marks: 3, marksStatus: "PRINTED" }).short, "[3]");
  assert.equal(marksLabel({ marks: 0, marksStatus: "GROUP_TOTAL", marksNote: "Q1: [10]" }).kind, "GROUP_TOTAL");
  assert.match(marksLabel({ marks: 0, marksStatus: "GROUP_TOTAL", marksNote: "Q1: [10]" }).long, /Q1: \[10\]/);
  assert.equal(marksLabel({ marks: 0, marksStatus: "FRACTIONAL", marksNote: "2½" }).short, "[2½]");
  const practice = marksLabel({ marks: 0, marksStatus: "NOT_PRINTED", practiceMarks: 2 });
  assert.equal(practice.kind, "PRACTICE");
  assert.match(practice.long, /suggestion, not printed/);
  assert.equal(marksLabel({ marks: 0, marksStatus: "NOT_PRINTED" }).kind, "UNAVAILABLE");
  // A practice suggestion never overrides a printed mark.
  assert.equal(marksLabel({ marks: 4, marksStatus: "PRINTED", practiceMarks: 2 }).short, "[4]");
});

test("a practice-marks suggestion never makes a question eligible for scored tests", () => {
  // practiceMarks isn't an input to paperEligibility at all; the stored printed mark decides.
  assert.equal(paperEligibility({ type: "SHORT_ANSWER", marks: 0, marksStatus: "NOT_PRINTED", answerKey: null, hasModelAnswer: true }).eligible, false);
});

test("mixed worksheet result: keyed questions checked, the rest not graded, no overall score", () => {
  const items = [
    { position: 1, marks: 1, question: { id: 1, type: "MCQ" as const, options: ["a", "b"], answer: { key: { correctOption: 1 } } } },
    { position: 2, marks: 0, question: { id: 2, type: "MCQ" as const, options: ["a", "b"], answer: { key: { correctOption: 0 } } } },
    { position: 3, marks: 0, question: { id: 3, type: "SHORT_ANSWER" as const, options: null, answer: { key: null } } },
    { position: 4, marks: 2, question: { id: 4, type: "MCQ" as const, options: ["a", "b"], answer: { key: null } } },
  ];
  const g = gradeSubmission(items, [
    { questionId: 1, response: "1" },
    { questionId: 2, response: "1" },
    { questionId: 3, response: "My answer." },
  ]);
  // A correct answer to an item with no printed mark earns no marks: correctness is shown, marks aren't invented.
  assert.deepEqual(
    g.rows.map((r) => [r.questionId, r.evaluationMethod, r.isCorrect, r.marksAwarded]),
    [
      [1, "AUTO", true, 1],
      [2, "AUTO", false, 0],
      [3, "NONE", null, null],
      [4, "NONE", null, null],
    ],
  );
  const w = worksheetSummary(
    g.rows.map((r, i) => ({ marks: items[i].marks, auto: r.evaluationMethod === "AUTO", answered: r.response !== null, correct: r.isCorrect })),
  );
  assert.deepEqual(w, { questions: 4, answered: 3, checked: 2, correct: 1, incorrect: 1, unanswered: 1, notGraded: 1, checkedMarks: { scored: 1, max: 1, questions: 1 } });
  // Nothing checkable: no marks summary at all.
  assert.equal(worksheetSummary([{ marks: 0, auto: false, answered: true, correct: null }]).checkedMarks, null);
});
