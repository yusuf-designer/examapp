import { test } from "node:test";
import assert from "node:assert/strict";
(globalThis as any).localStorage = { _d: {} as Record<string, string>, getItem(k: string) { return this._d[k] ?? null; }, setItem(k: string, v: string) { this._d[k] = v; } };
const { actions, getState, withNewSeedExams } = await import("../src/lib/store.ts");
const { seedState } = await import("../src/lib/seed.ts");
const { validateRubric } = await import("../src/lib/rubric.ts");

test("Physiology Paper II draft scheme is valid and ready for the evaluator to lock", () => {
  actions.resetDemo();
  const e = getState().exams.find((x) => x.id === "ex-phy2")!;
  assert.equal(e.questions.length, 4);
  for (const q of e.questions) { assert.deepEqual(validateRubric(q.rubric, q.marks), [], q.label); assert.equal(q.locked, false); }
  actions.switchUser("u-ev1");
  const q = e.questions[1]; actions.lockQuestion("ex-phy2", q.id, q.text, q.rubric);
  assert.equal(getState().exams.find((x) => x.id === "ex-phy2")!.questions[1].locked, true);
  actions.switchUser("u-ev3"); assert.throws(() => actions.saveDraft("ex-phy2", "q3b", "x", q.rubric), /not assigned/);
});

test("people with older saved data get the new exam without losing anything", () => {
  const old = seedState(); old.exams = old.exams.filter((x) => x.id !== "ex-phy2"); old.scripts = old.scripts.slice(0, 3);
  const merged = withNewSeedExams(old);
  assert.ok(merged.exams.some((x) => x.id === "ex-phy2")); assert.equal(merged.scripts.length, 3);
  assert.equal(withNewSeedExams(merged), merged);
});
