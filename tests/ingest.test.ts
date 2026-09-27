import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePaperText, suggestChapter } from "../src/lib/engine/ingest.ts";
import { isRealVerifiedPyq, validateProvenance } from "../src/lib/provenance.ts";

test("parses numbered questions, sections and marks", () => {
  const items = parsePaperText(`SECTION A
1. Define valency. [1]
2. Name the gas evolved when zinc reacts with dilute sulphuric acid.
   Write the balanced equation. (2 marks)
SECTION B
Question 3: (a) State Boyle's law. [2]
(b) A gas occupies 500 cm3 at 760 mm. Find its volume at 380 mm. [3]`);
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((i) => [i.questionNumber, i.section, i.marks]),
    [
      ["1", "A", 1],
      ["2", "A", 2],
      ["3", "B", 5],
    ],
  );
  assert.ok(items[1].text.includes("balanced equation"));
});

test("chapter suggestion uses keyword overlap", () => {
  const id = suggestChapter("State Boyle's law and the gas equation", [
    { id: 1, name: "Water", keywords: "hardness solubility" },
    { id: 2, name: "Study of Gas Laws", keywords: "boyle charles pressure volume" },
  ]);
  assert.equal(id, 2);
});

test("provenance: verified PYQ needs a non-demo board paper with a year", () => {
  const base = { sourceType: "VERIFIED_PYQ" as const, verificationStatus: "VERIFIED" as const, isDemo: false };
  const paper = { paperId: 1, title: "ICSE 2023 Chemistry", paperType: "BOARD_EXAM" as const, sourceUrl: null, questionNumber: "4", isDemo: false };
  assert.ok(validateProvenance({ ...base, sources: [] }));
  assert.ok(validateProvenance({ ...base, sources: [{ ...paper, year: null }] }));
  assert.equal(validateProvenance({ ...base, sources: [{ ...paper, year: 2023 }] }), null);
  assert.equal(isRealVerifiedPyq({ ...base, sources: [{ ...paper, year: 2023 }] }), true);
  // Demo data can never be a real PYQ, even when linked to a paper with a year.
  assert.equal(isRealVerifiedPyq({ ...base, isDemo: true, sources: [{ ...paper, year: 2023 }] }), false);
});
