import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Element: dom.window.Element, MutationObserver: dom.window.MutationObserver, getComputedStyle: dom.window.getComputedStyle, requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: (id: any) => clearTimeout(id), confirm: () => true });
for (const k of Object.getOwnPropertyNames(dom.window)) { if (/^(HTML|SVG)\w*Element$|^(Event|KeyboardEvent|MouseEvent|PointerEvent|FocusEvent|CustomEvent|DocumentFragment|DOMRect|Text|Comment|ShadowRoot|CSSStyleDeclaration)$/.test(k) && !(k in globalThis)) (globalThis as any)[k] = (dom.window as any)[k]; }
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
(dom.window as any).ResizeObserver = (globalThis as any).ResizeObserver;
(dom.window.HTMLElement.prototype as any).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as any).hasPointerCapture = () => false;
dom.window.scrollTo = () => {};
(dom.window as any).requestAnimationFrame = (f: any) => setTimeout(f, 0);
(dom.window as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { default: App } = await import("../src/App.tsx");
const { actions, getState } = await import("../src/lib/store.ts");

const errors: string[] = []; const orig = console.error; console.error = (...a: any[]) => { errors.push(a.map(String).join(" ").slice(0, 300)); };
const root = createRoot(document.getElementById("root")!);
const text = () => document.body.textContent ?? "";
const clickNav = async (label: string) => { const b = [...document.querySelectorAll("nav button")].find((x) => x.textContent?.includes(label)) as HTMLElement; assert.ok(b, `nav ${label}`); await act(async () => { b.click(); }); };
const mount = async () => { await act(async () => { root.render(React.createElement(App)); }); };
const as = async (id: string) => { await act(async () => { actions.signIn(id); }); };

test("the clean start opens every page for the Admin and an evaluator without crashing", async () => {
  await act(async () => { actions.resetAll(); }); await mount();
  for (const [id, pages] of [
    ["u-coe", ["Dashboard", "Scripts", "Marking schemes", "Edit requests", "Results and rechecks", "Audit trail"]],
    ["u-ev1", ["My marking", "Rechecks", "Marking schemes", "My edit requests", "My activity"]],
  ] as [string, string[]][]) {
    await as(id);
    for (const p of pages) { try { await clickNav(p); } catch (e: any) { throw new Error(`${id} ${p}: ` + (e.errors ?? [e]).map((x: any) => x.message).join(" ;; ")); } assert.ok(text().length > 60, `${id} ${p} rendered`); }
  }
  assert.deepEqual(errors.filter((e) => !e.includes("not wrapped in act")), []);
});

test("every role can open every page without crashing", async () => {
  await act(async () => { actions.resetDemo(); }); await mount();
  for (const [id, pages] of [
    ["u-coe", ["Dashboard", "Scripts", "Marking schemes", "Edit requests", "Results and rechecks", "Audit trail"]],
    ["u-hod", ["Dashboard", "Scripts", "Marking schemes", "Results and rechecks"]],
    ["u-dean", ["Dashboard", "Edit requests", "Results and rechecks", "Audit trail"]],
    ["u-ev1", ["My marking", "Rechecks", "Marking schemes", "My edit requests", "My activity"]],
    ["u-stu1", ["My graded script", "History of my script"]],
    ["u-aud", ["Dashboard", "Audit trail"]],
  ] as [string, string[]][]) {
    await as(id);
    for (const p of pages) { try { await clickNav(p); } catch (e: any) { throw new Error(`${id} ${p}: ` + (e.errors ?? [e]).map((x: any) => x.message + " " + String(x.stack).split("\n").slice(1, 4).join(" | ")).join(" ;; ")); } assert.ok(text().length > 100, `${id} ${p} rendered`); }
  }
  assert.deepEqual(errors.filter((e) => !e.includes("not wrapped in act")), []);
});
test("end-to-end through the UI state: assign, review page renders, student page after publish", async () => {
  await act(async () => { actions.resetDemo(); }); await mount();
  await as("u-coe"); await act(async () => { actions.assignScripts("ex-phy1", "by_question", { q2: "u-ev2", q3: "u-ev1" }, 10, 7); });
  await as("u-ev1"); await clickNav("My marking");
  assert.match(text(), /Answers assigned/); assert.match(text(), /Accept \d+ answers without flags/);
  const open = [...document.querySelectorAll("table button")].find((b) => b.textContent === "Review") as HTMLElement; await act(async () => { open.click(); });
  assert.ok(document.querySelector("[data-testid=mark-sheet]"), "one compact marks table"); assert.match(text(), /Agree and next/); assert.match(text(), /How the marks add up|Why you got|Total/);
  // finalise everything
  for (const u of ["u-ev1", "u-ev2"]) { await as(u); await act(async () => { try { actions.finaliseAllClean("ex-phy1"); } catch {} });
    for (const e of getState().evaluations.filter((x) => x.examinerId === u && x.status === "pending" && x.scriptId.startsWith("PHY-"))) { const f = getState().scripts.find((s) => s.id === e.scriptId)!.findings[e.qid]; await act(async () => { actions.finaliseEvaluation(e.id, { pointMarks: f.pointMarks, diagram: f.diagram, termsFound: f.termsFound, criticalError: f.criticalError }, ""); }); } }
  await as("u-dean"); await act(async () => { actions.signOff("ex-phy1"); }); await as("u-coe"); await act(async () => { actions.publishResults("ex-phy1", 5); });
  await as("u-stu1"); await mount(); await clickNav("My graded script");
  assert.match(text(), /Recheck window is open/); assert.match(text(), /Submit recheck request/);
  await as("u-coe"); await clickNav("Results and rechecks"); assert.match(text(), /Sign-off by the Admin/);
  await clickNav("Audit trail"); await act(async () => { ([...document.querySelectorAll("button")].find((b) => b.textContent === "Verify chain") as HTMLElement).click(); });
  assert.match(text(), /Chain verified/);
  await act(async () => { ([...document.querySelectorAll("button")].find((b) => b.textContent?.includes("tamper")) as HTMLElement).click(); });
  await act(async () => { ([...document.querySelectorAll("button")].find((b) => b.textContent === "Verify chain") as HTMLElement).click(); });
  assert.match(text(), /Chain broken at entry #3/);
  console.error = orig; assert.deepEqual(errors.filter((e) => !e.includes("not wrapped in act")), []);
});
test("login page shows first, SSO flow signs the chosen role in", async () => {
  await act(async () => { actions.resetDemo(); actions.signOut(); }); await mount();
  assert.match(text(), /Sign in/); assert.match(text(), /Continue with college SSO/);
  await act(async () => { actions.signIn("u-dean"); });
  assert.ok(document.querySelector("nav"), "app shell after sign in");
  await act(async () => { actions.signOut(); }); assert.match(text(), /Sign in/);
});

test("Scripts is a four-step wizard that blocks until the scheme is locked, then walks to assignment", async () => {
  await act(async () => { actions.resetDemo(); }); await mount(); await as("u-coe"); await clickNav("Scripts");
  const btn = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined;
  assert.match(text(), /Step 1 of 4/); assert.match(text(), /Choose the exam/);
  assert.equal(btn("Next")!.disabled, false, "Physiology Paper I is locked, so Next is open");
  await act(async () => { btn("Next")!.click(); }); assert.match(text(), /Step 2 of 4/); assert.match(text(), /scripts uploaded for this exam/);
  await act(async () => { btn("Next")!.click(); }); assert.match(text(), /Step 3 of 4/); assert.match(text(), /Answers each examiner will get/);
  await act(async () => { btn("Next")!.click(); }); assert.match(text(), /Step 4 of 4/);
  assert.equal(btn("Assign and notify examiners")!.disabled, false);
  await act(async () => { actions.assignScripts("ex-phy1", "by_question", { q2: "u-ev2", q3: "u-ev1" }, 10, 7); }); // the toast raised by the button needs a real browser
  assert.match(text(), /Scripts are with the examiners/); assert.ok(getState().assignedExamIds.includes("ex-phy1"));
  // the second-exam evaluators can still open their marking list
  await as("u-ev2"); await clickNav("My marking"); assert.match(text(), /Answers assigned/);
});

test("a student whose copy was uploaded and published sees the first real question, with no crash", async () => {
  const { evaluateScript, mockCall } = await import("../server/ai.ts");
  await act(async () => { actions.resetAll(); });
  const exam = getState().exams[0]; actions.switchUser("u-coe");
  const txt = exam.questions.map((q) => `${q.label}\nCortisol induces lipocortin which inhibits phospholipase A2`).join("\n");
  const r = await evaluateScript(mockCall, [{ kind: "text", text: txt }], exam.questions);
  await act(async () => {
    actions.addScannedScript(exam.id, "PHY-1401", "", r.answers, 1, r.warnings, { name: "Aisha Khan", rollNo: "2025-0501" });
    actions.assignScripts(exam.id, "by_question", Object.fromEntries(exam.questions.map((q) => [q.id, "u-ev1"])), 0, 7);
    for (const e of getState().evaluations.filter((x) => x.scriptId === "PHY-1401")) { actions.switchUser(e.examinerId); actions.finaliseEvaluation(e.id, e.mine, ""); }
    actions.switchUser("u-coe"); actions.signOff(exam.id); actions.publishResults(exam.id, 5);
  });
  errors.length = 0;
  await as(getState().users.find((u) => u.role === "student")!.id); await mount();
  assert.ok(text().includes("Question 2"), "the student sees the exam's first question");
  assert.ok(!errors.some((e) => /Cannot read|Uncaught/.test(e)), errors.join(" | "));
});
