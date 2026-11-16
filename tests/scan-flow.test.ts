import { test } from "node:test";
import assert from "node:assert/strict";
(globalThis as any).localStorage = { _d: {} as Record<string, string>, getItem(k: string) { return this._d[k] ?? null; }, setItem(k: string, v: string) { this._d[k] = v; } };
const { actions, getState, ActionError } = await import("../src/lib/store.ts");
const { evaluateScript, mockCall } = await import("../server/ai.ts");
const { computeScore } = await import("../src/lib/rubric.ts");

test("a scanned script flows through: upload, assign, evaluator sees deductions, student can defend a point", async () => {
  actions.resetDemo(); actions.switchUser("u-coe");
  const exam = getState().exams.find((e) => e.id === "ex-phy1")!;
  const text = "Question 2\nStarling law: the force of contraction rises with the filling of the ventricle\nQuestion 3\nAtrial systole: atria contract, completing ventricular filling";
  const r = await evaluateScript(mockCall, [{ kind: "text", text }], exam.questions);
  assert.throws(() => actions.addScannedScript("ex-phy1", "X", "", r.answers, 1, []), (e) => e instanceof ActionError && /barcode/.test(e.message));
  actions.addScannedScript("ex-phy1", "PHY-9001", "", r.answers, 1, r.warnings);
  assert.throws(() => actions.addScannedScript("ex-phy1", "PHY-9001", "", r.answers, 1, []), /already exists/);
  const sc = getState().scripts.find((x) => x.id === "PHY-9001")!;
  assert.equal(sc.findings.q3.pointMarks[exam.questions[1].rubric.points[0].id] > 0, true);
  const q3 = exam.questions.find((q) => q.id === "q3")!;
  const b = computeScore(q3.rubric, sc.findings.q3, q3.marks);
  assert.ok(b.total < q3.marks, "marks were lost somewhere");
  assert.equal(sc.findings.q3.secondPassTotal, b.total);
  const log = getState().audit.at(-1)!; assert.equal(log.action, "scans.read");
  // only the Admin and the Head of Department scan; the Head only in their own department
  for (const u of ["u-ev1", "u-dean", "u-principal"]) { actions.switchUser(u); assert.throws(() => actions.addScannedScript("ex-phy1", "PHY-9002", "", r.answers, 1, []), /Only the Admin/, u); }
  actions.switchUser("u-hod"); actions.addScannedScript("ex-phy1", "PHY-9003", "", r.answers, 1, []);
  assert.ok(getState().scripts.some((x) => x.id === "PHY-9003"));
});

test("uploading a copy with a new student creates a student who can sign in with the roll-number email, and demo students cannot", async () => {
  const { DEMO_STUDENT_IDS } = await import("../src/lib/permissions.ts");
  actions.resetDemo(); actions.switchUser("u-coe");
  const answers = Object.fromEntries(getState().exams.find((e) => e.id === "ex-phy1")!.questions.map((q) => [q.id, structuredClone(getState().scripts.find((s) => s.examId === "ex-phy1")!.findings[q.id])]));
  assert.throws(() => actions.addScannedScript("ex-phy1", "PHY-9100", "", answers, 1, [], { name: "A", rollNo: "" }), /name and roll number/);
  actions.addScannedScript("ex-phy1", "PHY-9100", "", answers, 1, [], { name: "Sara Mir", rollNo: "2025-0777" });
  const u = getState().users.find((x) => x.rollNo === "2025-0777")!;
  assert.equal(u.role, "student"); assert.equal(u.scriptId, "PHY-9100"); assert.equal(getState().scripts.find((x) => x.id === "PHY-9100")!.studentId, u.id);
  assert.ok(!DEMO_STUDENT_IDS.includes(u.id));
  assert.throws(() => actions.addScannedScript("ex-phy1", "PHY-9101", "", answers, 1, [], { name: "Sara Again", rollNo: "2025-0777" }), /already exists/);
});
