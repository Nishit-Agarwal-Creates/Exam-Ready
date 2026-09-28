import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error plain ESM script without type declarations
import { FLAT_POWER, decide } from "../scripts/review/consolidate.mjs";
import { coverageStatus } from "../src/lib/coverage-status.ts";
import { officialKind } from "../src/lib/provenance.ts";

const source = { sha256Match: true, official: true, metadataMatches: true };
const valid = new Set(["light", "electricity"]);
const item = { text: "State Ohm's law.", options: [], chapter: "electricity", confidence: "HIGH" };
const clean = { key: "k", text: "MATCH", numberPage: "MATCH", marks: "MATCH", options: "NA", notation: "OK", figure: "NONE", answer: "MATCH", chapter: "OK", decision: "PUBLISH" };

test("a clean, confirmed review publishes", () => {
  assert.equal(decide(item, clean, source, valid).state, "AUTO_VERIFIED");
});

test("no review means still pending, never published", () => {
  assert.equal(decide(item, undefined, source, valid).state, "PENDING_REVIEW");
});

test("each defect holds with its own reason, in precedence order", () => {
  assert.equal(decide(item, { ...clean, figure: "ESSENTIAL_MISSING" }, source, valid).state, "HOLD_MISSING_FIGURE");
  assert.equal(decide(item, { ...clean, answer: "MISMATCH" }, source, valid).state, "HOLD_ANSWER");
  assert.equal(decide(item, { ...clean, chapter: "UNCERTAIN" }, source, valid).state, "HOLD_MAPPING");
  assert.equal(decide(item, { ...clean, notation: "LOST" }, source, valid).state, "HOLD_LOW_CONFIDENCE");
  assert.equal(decide(item, { ...clean, decision: "HOLD", reason: "unsure" }, source, valid).state, "HOLD_LOW_CONFIDENCE");
  assert.equal(decide(item, clean, { ...source, sha256Match: false }, valid).state, "HOLD_MISSING_SOURCE");
  assert.equal(decide(item, { ...clean, figure: "ESSENTIAL_MISSING", answer: "MISMATCH" }, source, valid).state, "HOLD_MISSING_FIGURE");
  assert.equal(decide(item, { ...clean, decision: "REJECT", reason: "not real" }, source, valid).state, "REJECTED_INVALID");
});

test("a wrong chapter is remapped only to a valid slug", () => {
  const r = decide(item, { ...clean, chapter: "WRONG", suggestedChapter: "light" }, source, valid);
  assert.equal(r.state, "AUTO_VERIFIED");
  assert.equal(r.chapter, "light");
  assert.equal(decide(item, { ...clean, chapter: "WRONG", suggestedChapter: "made-up" }, source, valid).state, "HOLD_MAPPING");
});

test("an answer containing the extractor's own reconstruction is held", () => {
  const withNote = { ...item, officialAnswer: { text: "x = 5 (reconstructed from context)" } };
  assert.equal(decide(withNote, clean, source, valid).state, "HOLD_ANSWER");
});

test("flattened powers and unit exponents are caught; ordinary numbers are not", () => {
  const flat = (s: string) => FLAT_POWER.some((re: RegExp) => re.test(s));
  for (const s of ["d = 0.80 x 10-3 m", "4·5 × 108m2", "area 90cm2", "0·52 K kg mol-1"]) assert.equal(flat(s), true, s);
  for (const s of ["0.6 × 100 = 60%", "(6×100×100)/100", "Class 10-20, 20-30", "5 × 10⁻⁷ m²", "A-4, B-1"]) assert.equal(flat(s), false, s);
  assert.equal(decide({ ...item, text: "Find the area if r = 7 cm2" }, clean, source, valid).state, "HOLD_LOW_CONFIDENCE");
});

test("coverage wording counts only verified, source-backed questions", () => {
  assert.equal(coverageStatus({ verifiedPyq: 0, officialSample: 0, community: 0 }).label, "No verified material yet");
  assert.equal(coverageStatus({ verifiedPyq: 10, officialSample: 0, community: 0 }).tone, "limited");
  assert.equal(coverageStatus({ verifiedPyq: 30, officialSample: 25, community: 0 }).tone, "growing");
  assert.equal(coverageStatus({ verifiedPyq: 100, officialSample: 60, community: 0 }).tone, "strong");
});

test("official documents are named for what they are", () => {
  const q = (paperType: string) => ({ sourceType: "OFFICIAL_SAMPLE", isDemo: false, sources: [{ isDemo: false, paperType }] });
  assert.equal(officialKind(q("SPECIMEN") as never), "Official specimen");
  assert.equal(officialKind(q("QUESTION_BANK") as never), "Official question bank");
  assert.equal(officialKind(q("SAMPLE") as never), "Official sample");
  assert.equal(officialKind({ sourceType: "VERIFIED_PYQ", isDemo: false, sources: [] } as never), null);
});

test("only real exam years become PYQ filters (and cache keys)", async () => {
  const { examYear } = await import("../src/lib/exam-year.ts");
  assert.equal(examYear("2025"), 2025);
  for (const v of ["", "abc", "12345", "2025.5", "1800", "-2025"]) assert.equal(examYear(v), undefined, v);
});
