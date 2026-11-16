import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScore, validateRubric, diffInputs } from "../src/lib/rubric.ts";
import { Q3_RUBRIC, Q2_RUBRIC, seedState } from "../src/lib/seed.ts";
import { sha256 } from "../src/lib/hash.ts";
import { makeEntry, verifyChain } from "../src/lib/audit.ts";
import type { ScoreInput } from "../src/lib/types.ts";

const full: ScoreInput = {
  pointMarks: { q3p1: 1.5, q3p2: 1.5, q3p3: 1.5, q3p4: 1.5, q3p5: 1.5 },
  diagram: { present: true, elementsFound: Q3_RUBRIC.diagram.elements }, termsFound: Q3_RUBRIC.terminology.terms, criticalError: false,
};
test("rubrics balance to question totals", () => {
  assert.deepEqual(validateRubric(Q3_RUBRIC, 10), []); assert.deepEqual(validateRubric(Q2_RUBRIC, 5), []);
  assert.ok(validateRubric(Q3_RUBRIC, 9).length > 0);
});
test("full answer = 10", () => assert.equal(computeScore(Q3_RUBRIC, full, 10).total, 10));
test("no diagram loses all diagram marks", () => assert.equal(computeScore(Q3_RUBRIC, { ...full, diagram: { present: false, elementsFound: [] } }, 10).total, 8.5));
test("fewer than 3 diagram elements loses half", () => assert.equal(computeScore(Q3_RUBRIC, { ...full, diagram: { present: true, elementsFound: Q3_RUBRIC.diagram.elements.slice(0, 2) } }, 10).total, 9.25));
test("each missed term costs 0.25, capped by allocation", () => {
  assert.equal(computeScore(Q3_RUBRIC, { ...full, termsFound: ["isovolumetric"] }, 10).total, 9);
  assert.equal(computeScore(Q3_RUBRIC, { ...full, termsFound: [] }, 10).total, 9);
});
test("deal-breaker at zero caps at 5", () => {
  const b = computeScore(Q3_RUBRIC, { ...full, pointMarks: { ...full.pointMarks, q3p2: 0 } }, 10);
  assert.equal(b.total, 5); assert.equal(b.cap, 5); assert.deepEqual(b.dealBreakersMissing, ["q3p2"]);
});
test("critical error caps at 3, the stricter cap wins", () => {
  assert.equal(computeScore(Q3_RUBRIC, { ...full, criticalError: true }, 10).total, 3);
  assert.equal(computeScore(Q3_RUBRIC, { ...full, criticalError: true, pointMarks: { ...full.pointMarks, q3p4: 0 } }, 10).total, 3);
});
test("a partial deal-breaker is not capped", () => assert.equal(computeScore(Q3_RUBRIC, { ...full, pointMarks: { ...full.pointMarks, q3p4: 0.5 } }, 10).cap, null));
test("seeded student script matches the design story: AI 7.5, examiner 8.0", () => {
  const s = seedState().scripts.find((x) => x.id === "PHY-1042")!;
  const ai = computeScore(Q3_RUBRIC, s.findings.q3, 10); assert.equal(ai.total, 7.5);
  const mine = { ...s.findings.q3, pointMarks: { ...s.findings.q3.pointMarks, q3p5: 1.5 } };
  assert.equal(computeScore(Q3_RUBRIC, mine, 10).total, 8);
  assert.deepEqual(diffInputs(Q3_RUBRIC, s.findings.q3, mine), ["Point 5: 1 to 1.5"]);
});
test("same input gives same marks (determinism)", () => {
  const s = seedState(1).scripts.filter((x) => x.findings.q3); for (const x of s) assert.equal(computeScore(Q3_RUBRIC, x.findings.q3, 10).total, computeScore(Q3_RUBRIC, x.findings.q3, 10).total);
});
test("sha256 known vectors", () => {
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});
test("audit chain verifies and detects tampering", () => {
  const f = (a: string) => ({ ts: "t", actorId: "u", actorRole: "coe", action: a, target: "x", detail: "d" });
  const log = [makeEntry(undefined, f("a"))]; log.push(makeEntry(log[0], f("b"))); log.push(makeEntry(log[1], f("c")));
  assert.equal(verifyChain(log), null);
  const bad = log.map((e) => ({ ...e })); bad[1].detail = "changed"; assert.equal(verifyChain(bad), 2);
  assert.equal(verifyChain([log[0], log[2]]), 3);
  assert.equal(verifyChain(seedState().audit), null);
});
