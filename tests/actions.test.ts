import { test } from "node:test";
import assert from "node:assert/strict";
// minimal localStorage shim so the store loads under node
(globalThis as any).localStorage = { _d: {} as Record<string, string>, getItem(k: string) { return this._d[k] ?? null; }, setItem(k: string, v: string) { this._d[k] = v; } };
const { actions, getState, ActionError } = await import("../src/lib/store.ts");
const { verifyChain } = await import("../src/lib/audit.ts");
const as = (id: string) => actions.switchUser(id);
const fails = (fn: () => void, re: RegExp) => assert.throws(fn, (e: any) => e instanceof ActionError && re.test(e.message));

test("full workflow: assign, review, sign-off, publish, recheck, edit request", () => {
  actions.resetDemo();
  as("u-ev1"); fails(() => actions.assignScripts("ex-phy1", "by_question", {}, 10, 7), /Only|cannot assign/);
  as("u-coe");
  fails(() => actions.assignScripts("ex-phy1", "by_question", { q2: "u-ev1" }, 10, 7), /Choose an examiner/);
  actions.assignScripts("ex-phy1", "by_question", { q2: "u-ev2", q3: "u-ev1" }, 10, 7);
  assert.equal(getState().evaluations.filter((e) => e.scriptId.startsWith("PHY-")).length, 24, "the worked example has its own 4");
  fails(() => actions.assignScripts("ex-phy1", "by_question", { q2: "u-ev2", q3: "u-ev1" }, 10, 7), /Already/);
  // evaluator cannot finalise someone else's answer
  as("u-ev2"); fails(() => actions.finaliseEvaluation("PHY-1042:q3", getState().evaluations[0].mine, ""), /not assigned to you/);
  // override requires a reason
  as("u-ev1");
  const ev = getState().evaluations.find((e) => e.id === "PHY-1042:q3")!;
  const mine = { ...ev.mine, pointMarks: { ...ev.mine.pointMarks, q3p5: 1.5 } };
  fails(() => actions.finaliseEvaluation("PHY-1042:q3", mine, ""), /reason/);
  actions.finaliseEvaluation("PHY-1042:q3", mine, "Slowly equals reduced filling.");
  assert.equal(getState().scripts.find((s) => s.id === "PHY-1042")!.finalTotals.q3, 8);
  // cannot publish before everything is done
  as("u-dean"); fails(() => actions.signOff("ex-phy1"), /not finalised/);
  as("u-ev1"); actions.finaliseAllClean("ex-phy1");
  // flagged items remain; finalise them one by one unchanged
  for (const e of getState().evaluations.filter((x) => x.examinerId === "u-ev1" && x.status === "pending" && x.scriptId.startsWith("PHY-"))) {
    const f = getState().scripts.find((s) => s.id === e.scriptId)!.findings[e.qid];
    actions.finaliseEvaluation(e.id, { pointMarks: f.pointMarks, diagram: f.diagram, termsFound: f.termsFound, criticalError: f.criticalError }, "");
  }
  as("u-ev2"); actions.finaliseAllClean("ex-phy1");
  for (const e of getState().evaluations.filter((x) => x.examinerId === "u-ev2" && x.status === "pending" && x.scriptId.startsWith("PHY-"))) {
    const f = getState().scripts.find((s) => s.id === e.scriptId)!.findings[e.qid];
    actions.finaliseEvaluation(e.id, { pointMarks: f.pointMarks, diagram: f.diagram, termsFound: f.termsFound, criticalError: f.criticalError }, "");
  }
  as("u-coe"); fails(() => actions.publishResults("ex-phy1", 5), /Sign off the results first/);
  as("u-dean"); actions.signOff("ex-phy1");
  as("u-coe"); actions.publishResults("ex-phy1", 5);
  // student recheck
  as("u-stu2"); fails(() => actions.submitRecheck("PHY-1042", "q3", "x", "long enough comment here", []), /own script/);
  as("u-stu1");
  fails(() => actions.submitRecheck("PHY-1042", "q3", "Credit", "short", []), /at least 10/);
  actions.submitRecheck("PHY-1042", "q3", "A point I wrote was not credited", "Point 4 is on my diagram.", [{ text: "see diagram" }], [{ pointId: "p4", myAnswer: "I drew the relaxation phase on page 6." }]);
  assert.equal(getState().rechecks.at(-1)!.claims?.[0].myAnswer, "I drew the relaxation phase on page 6.");
  fails(() => actions.submitRecheck("PHY-1042", "q3", "Credit", "Point 4 is on my diagram.", []), /already/);
  as("u-coe"); fails(() => actions.assignRecheck("rc-1", "u-ev1"), /different from the first/);
  actions.assignRecheck("rc-1", "u-ev2");
  as("u-ev2");
  const f = getState().scripts.find((s) => s.id === "PHY-1042")!.findings.q3;
  actions.decideRecheck("rc-1", { pointMarks: { ...f.pointMarks, q3p4: 1.5 }, diagram: f.diagram, termsFound: f.termsFound, criticalError: false }, "Diagram shows pressure falling and volume constant.");
  assert.equal(getState().rechecks[0].newTotal, 8.5); // blind recheck starts from AI findings, p5 = 1.0
  assert.equal(verifyChain(getState().audit), null);
  // locked scheme: draft edits refused; edit request flow
  as("u-ev1"); const q3 = getState().exams[0].questions[1];
  fails(() => actions.saveDraft("ex-phy1", "q3", q3.text, q3.rubric), /locked/);
  const prop = structuredClone(q3.rubric); prop.caps.dealBreakerMissing = 4;
  actions.requestEdit("ex-phy1", "q3", prop, q3.text, "Cap of 5 is too lenient for deal-breakers.");
  fails(() => actions.requestEdit("ex-phy1", "q3", prop, q3.text, "Duplicate request for same question"), /pending/);
  as("u-hod"); fails(() => actions.decideEdit("er-1", true, "ok fine"), /Admin/);
  as("u-dean"); actions.decideEdit("er-1", true, "Agreed, stricter cap.");
  assert.equal(getState().exams[0].questions[1].version, 2);
  assert.equal(verifyChain(getState().audit), null);
});
test("entry window gates evaluator authoring; lock needs balanced marks", () => {
  actions.resetDemo(); as("u-ev3");
  const q = getState().exams[1].questions[0];
  const r = structuredClone(q.rubric); r.points = [{ id: "a", text: "Classification: ACE inhibitors, ARBs, CCBs, diuretics, beta-blockers", marks: 4, kind: "content" }, { id: "b", text: "ACE inhibitor blocks angiotensin I to II conversion, lowers aldosterone", marks: 4, kind: "deal_breaker" }];
  fails(() => actions.lockQuestion("ex-pha2", "q1", q.text, r), /must equal/);
  r.points.push({ id: "c", text: "Adverse effects: dry cough, angioedema, hyperkalaemia", marks: 2, kind: "content" });
  as("u-ev1"); fails(() => actions.lockQuestion("ex-pha2", "q1", q.text, r), /not assigned/);
  as("u-coe"); actions.setWindow("ex-pha2", "entry", false, 0, "Window closed early");
  as("u-ev3"); fails(() => actions.lockQuestion("ex-pha2", "q1", q.text, r), /window is closed/);
  as("u-coe"); actions.setWindow("ex-pha2", "entry", true, 2, "Reopen for late entry");
  as("u-ev3"); actions.lockQuestion("ex-pha2", "q1", q.text, r);
  assert.equal(getState().exams[1].questions[0].locked, true);
  fails(() => actions.saveDraft("ex-pha2", "q1", q.text, r), /locked/);
});

test("Controller, Dean, Principal and HOD cannot write or lock a scheme; only evaluators can, and the Admin can approve edits", () => {
  actions.resetDemo();
  const q = getState().exams.find((e) => e.id === "ex-pha2")!.questions[0];
  for (const u of ["u-coe", "u-dean", "u-principal", "u-hod"]) {
    as(u);
    fails(() => actions.saveDraft("ex-pha2", q.id, q.text, q.rubric), /Read only/);
    fails(() => actions.lockQuestion("ex-pha2", q.id, q.text, q.rubric), /Read only/);
  }
  as("u-coe"); fails(() => actions.assignScripts("ex-phy1", "by_question", {}, 10, 7), /Choose an examiner|Lock the scheme|No scripts/);
  // Only the Admin and the Head of Department assign copies; the Dean and Principal do not.
  for (const u of ["u-dean", "u-principal", "u-ev1"]) { as(u); fails(() => actions.assignScripts("ex-phy1", "by_question", { q2: "u-ev2", q3: "u-ev1" }, 10, 7), /Only the Admin/); }
  as("u-hod"); fails(() => actions.assignScripts("ex-phy1", "by_question", {}, 10, 7), /Choose an examiner|Lock the scheme|No scripts/);
});
