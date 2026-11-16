import { test } from "node:test";
import assert from "node:assert/strict";
(globalThis as any).localStorage = { _d: {} as Record<string, string>, getItem(k: string) { return this._d[k] ?? null; }, setItem(k: string, v: string) { this._d[k] = v; } };
const { getState, actions } = await import("../src/lib/store.ts");
const { computeScore } = await import("../src/lib/rubric.ts");
const { loadThumbs } = await import("../src/lib/api.ts");
const { SAMPLE_SCRIPT_ID } = await import("../src/lib/sample-booklet.ts");

test("the worked example is a real script with seven page pictures, marks that follow the scheme, and a crop for every line", () => {
  actions.resetDemo();
  const s = getState(); const exam = s.exams.find((e) => e.id === "ex-phy2w")!; const sc = s.scripts.find((x) => x.id === SAMPLE_SCRIPT_ID)!;
  assert.ok(exam.questions.every((q) => q.locked)); assert.ok(s.assignedExamIds.includes("ex-phy2w"));
  assert.equal(s.batches.find((b) => b.id === sc.batchId)!.synthetic, false);
  const totals = exam.questions.map((q) => computeScore(q.rubric, sc.findings[q.id], q.marks).total);
  assert.deepEqual(totals, [1, 2, 2.5, 2.75]);
  for (const q of exam.questions) for (const l of sc.findings[q.id].transcript) {
    assert.ok(l.page! >= 1 && l.page! <= 7, `${l.text} page`); assert.ok(l.y0! >= 0 && l.y1! <= 1 && l.y0! < l.y1!, `${l.text} range`);
  }
  assert.equal(loadThumbs(SAMPLE_SCRIPT_ID).length, 7);
  assert.equal(s.evaluations.filter((e) => e.scriptId === SAMPLE_SCRIPT_ID).length, 4);
  // every lost mark has a reason the evaluator and the student can read
  for (const q of exam.questions) for (const p of q.rubric.points) { const f = sc.findings[q.id]; if (f.pointMarks[p.id] < p.marks) assert.ok(f.evidence[p.id].reason, `${q.label} ${p.id}`); }
});

test("a student with the real booklet exists, published, with the same seven page pictures and marks", async () => {
  actions.resetDemo();
  const s = getState(); const u = s.users.find((x) => x.id === "u-stu3")!; const sc = s.scripts.find((x) => x.id === u.scriptId)!; const exam = s.exams.find((e) => e.id === sc.examId)!;
  assert.ok(exam.published && exam.windows.recheck.state === "open");
  assert.equal(loadThumbs(sc.id).length, 7);
  assert.deepEqual(exam.questions.map((q) => sc.finalTotals[q.id]), [1, 2, 2.5, 2.75]);
  assert.ok(s.evaluations.filter((e) => e.scriptId === sc.id).every((e) => e.status === "finalised"));
});
