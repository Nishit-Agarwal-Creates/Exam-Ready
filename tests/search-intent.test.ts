import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretQuery, subjectIdsFor, type IntentCatalog } from "../src/lib/engine/search-intent.ts";

const catalog: IntentCatalog = [
  {
    id: 1,
    slug: "icse",
    name: "ICSE",
    classes: [
      { id: 10, level: 9, name: "Class 9", subjects: [{ id: 100, slug: "chemistry", name: "Chemistry", chapters: [{ id: 1000, slug: "atomic-structure", name: "Atomic Structure and Chemical Bonding" }] }] },
      {
        id: 11,
        level: 10,
        name: "Class 10",
        subjects: [
          { id: 110, slug: "physics", name: "Physics", chapters: [{ id: 1100, slug: "current-electricity", name: "Current Electricity" }] },
          { id: 111, slug: "mathematics", name: "Mathematics", chapters: [{ id: 1110, slug: "quadratic-equations", name: "Quadratic Equations" }] },
        ],
      },
      { id: 12, level: 12, name: "Class 12 (ISC)", subjects: [{ id: 120, slug: "physics", name: "Physics", chapters: [] }] },
    ],
  },
  {
    id: 2,
    slug: "cbse",
    name: "CBSE",
    classes: [
      {
        id: 21,
        level: 10,
        name: "Class 10",
        subjects: [
          {
            id: 210,
            slug: "science",
            name: "Science",
            chapters: [
              { id: 2100, slug: "electricity", name: "Electricity" },
              { id: 2101, slug: "heredity", name: "Heredity" },
              { id: 2102, slug: "chemical-reactions-and-equations", name: "Chemical Reactions and Equations" },
            ],
          },
          { id: 211, slug: "mathematics", name: "Mathematics", chapters: [{ id: 2110, slug: "quadratic-equations", name: "Quadratic Equations" }] },
        ],
      },
    ],
  },
];

test("board, class and chapter from plain words", () => {
  const r = interpretQuery("Class 10 CBSE electricity", catalog);
  assert.equal(r.boardId, 2);
  assert.equal(r.classId, 21);
  assert.equal(r.subjectId, 210);
  assert.equal(r.chapterId, 2100);
  assert.equal(r.text, undefined);
});

test("ICSE class 9 chapter with a partial chapter name", () => {
  const r = interpretQuery("ICSE Class 9 atomic structure", catalog);
  assert.equal(r.classId, 10);
  assert.equal(r.chapterId, 1000);
});

test("ICSE Class 10 quadratic equations resolves to the ICSE chapter, not CBSE", () => {
  const r = interpretQuery("ICSE Class 10 quadratic equations", catalog);
  assert.equal(r.chapterId, 1110);
  assert.equal(r.subjectId, 111);
});

test("paper code, year and subject", () => {
  const r = interpretQuery("2026 Science QP 31/2/1", catalog);
  assert.equal(r.year, 2026);
  assert.equal(r.paperCode, "31/2/1");
  assert.equal(r.subjectId, 210);
  assert.equal(r.text, undefined);
});

test("topic phrasing without board or class infers the chapter", () => {
  const r = interpretQuery("questions on heredity", catalog);
  assert.equal(r.chapterId, 2101);
  assert.equal(r.boardId, 2);
});

test("repeated flag and multi-word chapter", () => {
  const r = interpretQuery("repeated questions chemical reactions", catalog);
  assert.equal(r.repeatedOnly, true);
  assert.equal(r.chapterId, 2102);
});

test("ISC means CISCE class 12", () => {
  const r = interpretQuery("ISC physics", catalog);
  assert.equal(r.boardId, 1);
  assert.equal(r.subjectId, 120);
});

test("subject without class keeps every matching subject", () => {
  const r = interpretQuery("physics refraction of light", catalog);
  assert.equal(r.subjectId, undefined);
  assert.deepEqual(subjectIdsFor(r, catalog).sort(), [110, 120]);
  assert.equal(r.text, "refraction light");
});

test("marks, type and question number", () => {
  const r = interpretQuery("5 marks case based question 34 cbse", catalog);
  assert.equal(r.marks, 5);
  assert.equal(r.type, "CASE_BASED");
  assert.equal(r.questionNumber, "34");
  assert.equal(r.boardId, 2);
});

test("unknown words stay as text and nothing is invented", () => {
  const r = interpretQuery("ozone layer depletion", catalog);
  assert.equal(r.chapterId, undefined);
  assert.equal(r.subjectId, undefined);
  assert.equal(r.text, "ozone layer depletion");
});

test("document kind, answers and figures are understood", () => {
  const i = interpretQuery("icse class 10 physics specimen with answers", catalog);
  assert.equal(i.paperType, "SPECIMEN");
  assert.equal(i.hasAnswer, true);
  assert.equal(interpretQuery("cbse sample paper", catalog).paperType, "SAMPLE");
  assert.equal(interpretQuery("science question bank", catalog).paperType, "QUESTION_BANK");
  assert.equal(interpretQuery("questions without diagrams", catalog).hasFigure, false);
  // A topic word is not a filter.
  assert.equal(interpretQuery("ray diagram questions", catalog).hasFigure, undefined);
});
