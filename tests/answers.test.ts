import assert from "node:assert/strict";
import { test } from "node:test";
import { answerIssues, draftStatus, planPublish, publishedStatus, validateDraft } from "../src/lib/engine/answers.ts";
import { paperEligibility } from "../src/lib/engine/eligibility.ts";

test("answer statuses: official, editor-reviewed (never official), AI practice, missing; drafts are separate", () => {
  assert.equal(publishedStatus({ answerSource: "OFFICIAL_SCHEME", answerText: "x", answerKey: null }), "OFFICIAL");
  assert.equal(publishedStatus({ answerSource: "EDITOR", answerText: "x", answerKey: null }), "EDITOR_REVIEWED");
  assert.equal(publishedStatus({ answerSource: "NONE", answerText: "x", answerKey: null }), "EDITOR_REVIEWED");
  assert.equal(publishedStatus({ answerSource: "AI", answerText: "x", answerKey: null }), "AI_PRACTICE");
  assert.equal(publishedStatus({ answerSource: "OFFICIAL_SCHEME", answerText: "  ", answerKey: null }), "MISSING");
  assert.equal(draftStatus({ origin: "AI", text: "x" }), "AI_DRAFT");
  assert.equal(draftStatus({ origin: "EDITOR", text: "x" }), "EDITOR_DRAFT");
  assert.equal(draftStatus(null), null);
});

test("an unreviewed draft never becomes a grading key: eligibility reads only the published answer", () => {
  // The question has an AI draft with a key, but nothing published: still not markable.
  const published = { type: "MCQ", marks: 1, marksStatus: "PRINTED", options: ["a", "b", "c", "d"], answerKey: null, hasModelAnswer: false };
  assert.equal(paperEligibility(published).eligible, false);
  const issues = answerIssues({
    type: "MCQ",
    marks: 1,
    marksStatus: "PRINTED",
    options: ["a", "b", "c", "d"],
    answerKey: null,
    answerText: "",
    answerRubric: "",
    answerSource: "NONE",
    answerMeta: null,
    answerDraft: { origin: "AI", text: "", key: { correctOption: 2 } },
    hasFigure: false,
    figureCount: 0,
    lowConfidence: false,
    sourceLinks: 1,
  });
  assert.deepEqual(issues, ["NO_KEY", "AI_DRAFT"]);
});

test("draft validation: keys must fit the question; tolerances need a reason; practice marks are whole numbers", () => {
  const opts = ["a", "b", "c"];
  assert.deepEqual(validateDraft("MCQ", opts, { text: "", key: { correctOption: 1 } }), {});
  assert.ok(validateDraft("MCQ", opts, { text: "", key: { correctOption: 5 } }).key);
  assert.ok(validateDraft("SHORT_ANSWER", null, { text: "", key: null }).text);
  assert.ok(validateDraft("SHORT_ANSWER", null, { text: "x", key: { accepted: ["x"] } }).key);
  assert.ok(validateDraft("FILL_BLANK", null, { text: "", key: { accepted: [" "] } }).key);
  assert.ok(validateDraft("NUMERICAL", null, { text: "", key: { value: 9.8, tolerance: 0.1 } }).notes);
  assert.deepEqual(validateDraft("NUMERICAL", null, { text: "", key: { value: 9.8, tolerance: 0.1 }, notes: "Answer rounded to 1 d.p." }), {});
  assert.ok(validateDraft("SHORT_ANSWER", null, { text: "x", practiceMarks: 0 }).practiceMarks);
  assert.ok(validateDraft("SHORT_ANSWER", null, { text: "x", practiceMarks: 2.5 }).practiceMarks);
  assert.deepEqual(validateDraft("SHORT_ANSWER", null, { text: "x", practiceMarks: 3 }), {});
  assert.ok(validateDraft("SHORT_ANSWER", null, { text: "x", source: { url: "http://x" } }).source);
});

test("publishing: editor-reviewed by default; official only with a named source the editor checked", () => {
  const draft = { origin: "AI" as const, text: "Osmosis is ...", rubric: "1. Definition", key: null };
  const base = { editor: "admin", at: "2026-10-14T00:00:00Z" };
  const r1 = planPublish("SHORT_ANSWER", null, draft, { ...base, asOfficial: false, sourceChecked: false });
  assert.ok(r1.ok);
  if (r1.ok) {
    assert.equal(r1.plan.answerSource, "EDITOR");
    assert.equal(r1.plan.answerMeta.sourceChecked, false);
    assert.equal(r1.plan.answerRubric, "1. Definition");
  }
  const r2 = planPublish("SHORT_ANSWER", null, draft, { ...base, asOfficial: true, sourceChecked: false, source: { title: "CISCE 2025 marking scheme", questionNumber: "4" } });
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.ok(r2.errors.sourceChecked);
  const r3 = planPublish("SHORT_ANSWER", null, draft, { ...base, asOfficial: true, sourceChecked: true });
  assert.equal(r3.ok, false);
  if (!r3.ok) assert.ok(r3.errors.source);
  const r4 = planPublish("SHORT_ANSWER", null, draft, { ...base, asOfficial: true, sourceChecked: true, source: { title: "CISCE 2025 marking scheme", questionNumber: "4" } });
  assert.ok(r4.ok);
  if (r4.ok) {
    assert.equal(r4.plan.answerSource, "OFFICIAL_SCHEME");
    assert.equal(r4.plan.answerMeta.sourceChecked, true);
  }
  // An invalid key can't be published at all.
  const r5 = planPublish("MCQ", ["a", "b"], { origin: "EDITOR", text: "", key: { correctOption: 3 } }, { ...base, asOfficial: false, sourceChecked: false });
  assert.equal(r5.ok, false);
});

test("review-queue issues reflect missing keys, marks, options, rubrics, sources and unchecked citations", () => {
  const issues = answerIssues({
    type: "SHORT_ANSWER",
    marks: 0,
    marksStatus: "GROUP_TOTAL",
    options: null,
    answerKey: null,
    answerText: "",
    answerRubric: "",
    answerSource: "EDITOR",
    answerMeta: { source: { title: "Some book" }, sourceChecked: false },
    answerDraft: { origin: "EDITOR", text: "draft" },
    hasFigure: true,
    figureCount: 0,
    lowConfidence: false,
    sourceLinks: 0,
  });
  assert.deepEqual(issues, ["NO_MARKS", "NO_RUBRIC", "INCOMPLETE_SOURCE", "EDITOR_DRAFT", "SOURCE_UNCHECKED"]);
  assert.deepEqual(
    answerIssues({
      type: "MCQ",
      marks: 1,
      marksStatus: "PRINTED",
      options: ["a"],
      answerKey: { correctOption: 0 },
      answerText: "",
      answerRubric: "",
      answerSource: "OFFICIAL_SCHEME",
      answerMeta: null,
      answerDraft: null,
      hasFigure: false,
      figureCount: 0,
      lowConfidence: false,
      sourceLinks: 1,
    }),
    // A key into the one stored option fits; the problem to fix is the missing options.
    ["OPTIONS"],
  );
});
