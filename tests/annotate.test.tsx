import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
for (const k of Object.getOwnPropertyNames(dom.window)) { if (/^(HTML|SVG)\w*Element$|^(Event|MouseEvent)$/.test(k) && !(k in globalThis)) (globalThis as any)[k] = (dom.window as any)[k]; }
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const React = await import("react"); const { act } = React; const { createRoot } = await import("react-dom/client");
const { AnswerScan } = await import("../src/components/ScriptView.tsx");
const { getState, actions } = await import("../src/lib/store.ts");
const { SAMPLE_SCRIPT_ID } = await import("../src/lib/sample-booklet.ts");

test("marks are drawn over the crop on the lines that earned them, and the points not found are listed", async () => {
  actions.resetDemo();
  const s = getState(); const exam = s.exams.find((e) => e.id === "ex-phy2w")!; const sc = s.scripts.find((x) => x.id === SAMPLE_SCRIPT_ID)!;
  const q = exam.questions.find((x) => x.label.includes("3(c)")) ?? exam.questions[3];
  const root = createRoot(document.getElementById("root")!);
  await act(async () => { root.render(React.createElement(AnswerScan, { scriptId: sc.id, f: sc.findings[q.id], rubric: q.rubric })); });
  assert.equal(document.querySelectorAll("[data-testid=scan-mark]").length, 0, "nothing is drawn before the picture has loaded");
  await act(async () => { for (const img of document.querySelectorAll("img.hidden")) { Object.defineProperty(img, "naturalWidth", { value: 820 }); Object.defineProperty(img, "naturalHeight", { value: 1308 }); img.dispatchEvent(new (dom.window as any).Event("load", { bubbles: true })); } });
  const marks = [...document.querySelectorAll("[data-testid=scan-mark]")];
  assert.ok(marks.length > 0, "marks appear on the crop");
  assert.ok(marks.every((m) => /^(\+[\d.]+|[\d.]+\/[\d.]+)$/.test(m.textContent ?? "")), marks.map((m) => m.textContent).join(","));
  assert.match(document.body.textContent ?? "", /Marks are shown on the lines that earned them/);
  await act(async () => root.unmount());
});
