import test from "node:test";
import assert from "node:assert/strict";
import { cleanState } from "../src/lib/seed";
import { validateRubric } from "../src/lib/rubric";
import { withNewSeedExams } from "../src/lib/store";

test("the demo scheme is filled in: numbered questions, marks that add up, and an expected answer for each", () => {
  const ex = cleanState().exams[0];
  assert.deepEqual(ex.questions.map((q) => q.label), ["Question 2", "Question 2(e)", "Question 3(a)", "Question 3(c)", "Question 4"]);
  assert.equal(ex.questions.reduce((n, q) => n + q.marks, 0), 26);
  for (const q of ex.questions) {
    assert.deepEqual(validateRubric(q.rubric, q.marks), [], `${q.label} marks must add up`);
    assert.ok(q.modelAnswer && q.modelAnswer.length > 40, `${q.label} has an expected answer`);
    assert.ok(q.locked);
  }
});

test("older clean data gets the expected answers and Question 4 without losing anything", () => {
  const fresh = cleanState();
  const old = structuredClone(fresh);
  old.exams[0].questions = old.exams[0].questions.filter((q) => q.id !== "q4");
  old.exams[0].questions = old.exams[0].questions.slice(0, 4).map((q) => { const { modelAnswer: _m, ...rest } = q; return rest as typeof q; });
  const up = withNewSeedExams(old);
  assert.equal(up.exams[0].questions.length, 5);
  assert.ok(up.exams[0].questions.every((q) => !!q.modelAnswer));
});
