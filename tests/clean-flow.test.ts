import { test } from "node:test";
import assert from "node:assert/strict";
(globalThis as any).localStorage = { _d: {} as Record<string, string>, getItem(k: string) { return this._d[k] ?? null; }, setItem(k: string, v: string) { this._d[k] = v; }, removeItem(k: string) { delete this._d[k]; } };
const { actions, getState } = await import("../src/lib/store.ts");
const { evaluateScript, mockCall } = await import("../server/ai.ts");

test("the clean start holds no scripts or students, and one copy goes from upload to the student's published result", async () => {
  actions.resetAll();
  const s0 = getState();
  assert.equal(s0.scripts.length, 0); assert.equal(s0.evaluations.length, 0); assert.equal(s0.batches.length, 0);
  assert.ok(!s0.users.some((u) => u.role === "student")); assert.deepEqual(s0.users.map((u) => u.role).sort(), ["coe", "evaluator", "evaluator", "evaluator"]);
  const exam = s0.exams[0]; assert.equal(s0.exams.length, 1); assert.ok(exam.questions.every((q) => q.locked));
  actions.switchUser("u-coe");
  const text = exam.questions.map((q) => `${q.label}\nSpermatogenesis needs a temperature lower than body heat`).join("\n");
  const r = await evaluateScript(mockCall, [{ kind: "text", text }], exam.questions);
  actions.addScannedScript(exam.id, "PHY-1301", "", r.answers, 1, r.warnings, { name: "Sara Mir", rollNo: "2025-0777" });
  const stu = getState().users.find((u) => u.role === "student")!; assert.equal(stu.scriptId, "PHY-1301");
  actions.assignScripts(exam.id, "by_question", Object.fromEntries(exam.questions.map((q, i) => [q.id, i % 2 ? "u-ev2" : "u-ev1"])), 0, 7);
  for (const e of getState().evaluations.filter((x) => x.scriptId === "PHY-1301")) { actions.switchUser(e.examinerId); actions.finaliseEvaluation(e.id, e.mine, ""); }
  actions.switchUser("u-coe"); actions.signOff(exam.id); actions.publishResults(exam.id, 5);
  const done = getState(); assert.ok(done.exams[0].published);
  assert.ok(exam.questions.every((q) => done.scripts[0].finalTotals[q.id] !== undefined));
});

test("old shared data from before the clean start is replaced, not merged", async () => {
  const { attachRemote, sharedPart } = await import("../src/lib/store.ts"); const { seedState } = await import("../src/lib/seed.ts");
  actions.resetAll(); const writes: any[] = []; const remote = attachRemote((v) => writes.push(v));
  remote.receive(sharedPart(seedState()) as any);
  assert.equal(getState().scripts.length, 0, "the old demo scripts are not taken in");
  assert.equal(writes.length, 1, "the clean data is written over the old shared data"); assert.equal(writes[0].dataVersion, 3);
});
