import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePaperText, suggestChapter } from "../src/lib/engine/ingest.ts";
import { frequencyLine, frequencyOf, isRealVerifiedPyq, provenanceYears, validateProvenance } from "../src/lib/provenance.ts";

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

test("detects MCQ and assertion-reason options, pages and confidence", () => {
  const items = parsePaperText(
    "=== Page 3 ===\nSECTION A\n1. Which gas is evolved when zinc reacts with dilute HCl? (A) Oxygen (B) Hydrogen (C) Chlorine (D) Nitrogen [1]\n" +
      "\f2. Assertion (A) : Ozone absorbs UV radiation. Reason (R) : Ozone is O3. (A) Both A and R are true (B) A true, R false (C) A false, R true (D) Both false [1]\n" +
      "3. Study the diagram given below and label the parts.",
  );
  assert.equal(items[0].type, "MCQ");
  assert.deepEqual(items[0].options, ["Oxygen", "Hydrogen", "Chlorine", "Nitrogen"]);
  assert.equal(items[0].page, 3);
  assert.equal(items[0].confidence, "HIGH");
  assert.equal(items[1].type, "ASSERTION_REASON");
  assert.equal(items[1].page, 4);
  assert.equal(items[2].confidence, "MEDIUM");
  assert.ok(items[2].issues.some((i) => i.includes("figure")));
  const ocr = parsePaperText("=== Page 1 ===\n1. Define valency. [1]", { 1: 42 });
  assert.equal(ocr[0].confidence, "LOW");
});

test("provenance: AI and demo questions can never become PYQs", () => {
  const paper = { paperId: 1, title: "CBSE 2025 Science", paperType: "BOARD_EXAM" as const, sourceUrl: null, questionNumber: "4", isDemo: false, year: 2025 };
  assert.ok(validateProvenance({ sourceType: "VERIFIED_PYQ", verificationStatus: "UNVERIFIED", isDemo: false, sources: [paper] }, { sourceType: "AI_SUPPLEMENTARY" }));
  assert.ok(validateProvenance({ sourceType: "VERIFIED_PYQ", verificationStatus: "VERIFIED", isDemo: true, sources: [paper] }));
  assert.ok(validateProvenance({ sourceType: "PENDING_REVIEW", verificationStatus: "VERIFIED", isDemo: false, sources: [paper] }));
  assert.equal(isRealVerifiedPyq({ sourceType: "AI_SUPPLEMENTARY", verificationStatus: "VERIFIED", isDemo: false, sources: [paper] }), false);
  // Unverified PYQ candidates never display a year or frequency
  const pending = { sourceType: "VERIFIED_PYQ" as const, verificationStatus: "UNVERIFIED" as const, isDemo: false, sources: [paper] };
  assert.equal(provenanceYears(pending), null);
  assert.equal(frequencyLine(pending), null);
});

test("frequency counts distinct exam years, not sets of one year", () => {
  const verified = { sourceType: "VERIFIED_PYQ" as const, verificationStatus: "VERIFIED" as const, isDemo: false };
  const set1 = { paperId: 1, title: "2026 set 1", paperType: "BOARD_EXAM" as const, sourceUrl: null, questionNumber: "3", isDemo: false, year: 2026 };
  const set2 = { ...set1, paperId: 2, title: "2026 set 2" };
  const y2024 = { ...set1, paperId: 3, year: 2024 };
  assert.deepEqual(frequencyOf([set1, set2]).years, [2026]);
  assert.equal(frequencyLine({ ...verified, sources: [set1] }, [set1, set2]), "Seen in 2 paper sets of the 2026 exam (one exam year)");
  assert.equal(frequencyLine({ ...verified, sources: [set1] }, [set1, set2, y2024]), "Appeared in 2 verified exam years (2026, 2024), 3 paper sets in all");
});

test("trend tags are factual and only for verified PYQs", async () => {
  const { trendTags } = await import("../src/lib/provenance.ts");
  const verified = { sourceType: "VERIFIED_PYQ" as const, verificationStatus: "VERIFIED" as const, isDemo: false };
  const p = (paperId: number, year: number) => ({ paperId, title: `p${paperId}`, paperType: "BOARD_EXAM" as const, sourceUrl: null, questionNumber: "1", isDemo: false, year });
  // Two sets of one year: a same-year repeat, not a multi-year one.
  assert.deepEqual(trendTags({ ...verified, sources: [p(1, 2026)] }, [p(1, 2026), p(2, 2026)], 2026), ["2 sets, 2026", "Recent: 2026"]);
  // Three exam years, first seen long before the latest year.
  assert.deepEqual(trendTags({ ...verified, sources: [p(1, 2026)] }, [p(1, 2026), p(3, 2024), p(4, 2019)], 2026), ["3 exam years", "Recent: 2026", "First seen 2019"]);
  // Pending questions never get tags.
  assert.deepEqual(trendTags({ ...verified, verificationStatus: "UNVERIFIED", sources: [p(1, 2026)] }, [p(1, 2026), p(2, 2025)], 2026), []);
});
