import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error plain ESM script without type declarations
import { FLAT_POWER, decide, pickAuditCheck } from "../scripts/review/consolidate.mjs";
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

test("pack notation markup becomes super/subscripts without touching blanks", async () => {
  const { parseMath } = await import("../src/lib/math-markup.ts");
  const kinds = (s: string) => parseMath(s).map((p) => `${p.kind}:${p.value}`).join("|");
  assert.equal(kinds("4 x 10^8 m/s"), "text:4 x 10|sup:8|text: m/s");
  assert.equal(kinds("e^(–Ea/RT)"), "text:e|sup:–Ea/RT");
  assert.equal(kinds("((3²)^(1/3))"), "text:((3²)|sup:1/3|text:)");
  assert.equal(kinds("∫_{π/4}^{3π/4} f"), "text:∫|sub:π/4|sup:3π/4|text: f");
  assert.equal(kinds("X^C blood"), "text:X|sup:C|text: blood");
  assert.equal(kinds("Fill in ____ and ___"), "text:Fill in ____ and ___");
  assert.equal(kinds("x^ab"), "text:x^ab");
});

test("isIndented keeps code indentation only for indented lines", async () => {
  const { isIndented } = await import("../src/lib/math-markup.ts");
  assert.equal(isIndented("for i in range(3):\n    print(i)"), true);
  assert.equal(isIndented("if (x > 0)\n\treturn x;"), true);
  assert.equal(isIndented("Define refraction.\nState Snell's law."), false);
  assert.equal(isIndented("Trailing spaces \n"), false);
  assert.equal(isIndented(null), false);
});

test("a whole class is measured against the 600-question goal", () => {
  assert.equal(coverageStatus({ verifiedPyq: 0, officialSample: 177, community: 0 }, "class").tone, "limited");
  assert.equal(coverageStatus({ verifiedPyq: 100, officialSample: 150, community: 0 }, "class").tone, "growing");
  assert.equal(coverageStatus({ verifiedPyq: 400, officialSample: 250, community: 0 }, "class").tone, "strong");
});

test("a recovered figure publishes only with a real source-page crop attached", () => {
  const recovered = { ...clean, figure: "RECOVERED" };
  const crop = { src: "/figures/p/3.png", page: 3, crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.3 }, method: "SOURCE_PAGE_CROP" };
  assert.equal(decide({ ...item, figures: [crop] }, recovered, source, valid).state, "AUTO_VERIFIED");
  assert.equal(decide(item, recovered, source, valid).state, "HOLD_MISSING_FIGURE");
  assert.equal(decide({ ...item, figures: [{ ...crop, method: "REDRAWN" }] }, recovered, source, valid).state, "HOLD_MISSING_FIGURE");
  assert.equal(decide(item, { ...clean, figure: "ESSENTIAL_MISSING" }, source, valid).state, "HOLD_MISSING_FIGURE");
});

test("audit disputes win unless a recovered question was re-audited later", () => {

  const checks = [
    { key: "k", agree: false, order: 1 },
    { key: "k", agree: true, order: 2, round: "p51" },
  ];
  assert.equal(pickAuditCheck(checks, false).agree, false);
  assert.equal(pickAuditCheck(checks, true).agree, true);
  // A recovered question is judged only on re-audit checks made after the recovery.
  assert.equal(pickAuditCheck([{ key: "k", agree: true, order: 1 }], true), null);
  assert.equal(pickAuditCheck([{ key: "k", agree: true, order: 2, round: "p51" }, { key: "k", agree: false, order: 3, round: "p51" }], true).agree, false);
  // A question changed again by the audit fix round is judged only by checks made after the fix.
  assert.equal(pickAuditCheck(checks, "p51-fix"), null);
  assert.equal(pickAuditCheck([...checks, { key: "k", agree: false, order: 3, round: "p51-fix" }], "p51-fix").agree, false);
  assert.equal(pickAuditCheck([...checks, { key: "k", agree: false, order: 3, round: "p51-fix" }], "p51").agree, false);
  // A question changed by the final fix round is judged only by the final audit round.
  assert.equal(pickAuditCheck([...checks, { key: "k", agree: true, order: 3, round: "p51-fix" }], "p51-final"), null);
  assert.equal(pickAuditCheck([...checks, { key: "k", agree: true, order: 4, round: "p51-final" }], "p51-final").agree, true);
});
