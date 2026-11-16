import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
(globalThis as any).localStorage = { _d: {} as Record<string, string>, getItem(k: string) { return this._d[k] ?? null; }, setItem(k: string, v: string) { this._d[k] = v; }, removeItem(k: string) { delete this._d[k]; } };
const { evaluateScript } = await import("../server/ai.ts");
const { server, useSetup } = await import("../server/index.ts");
const { cleanState } = await import("../src/lib/seed.ts");
const { LiveScan, liveReduce, liveStart } = await import("../src/components/LiveScan.tsx");
const { scanStream } = await import("../src/lib/api.ts");
const { fileStore } = await import("../server/store.ts");

const questions = cleanState().exams[0].questions;
const qin = questions.map((q) => ({ id: q.id, label: q.label, text: q.text, marks: q.marks, rubric: q.rubric }));
const reading = { kind: "reading" as const, page: 1, lines: [
  { text: "Roll No: 2025-0501" }, { text: "Q2. Atherosclerosis" }, { text: "Definition: progressive disease of arteries with an atheroma" }, { text: "Endothelial injury from smoking and hypertension" },
  { text: "Q2 e) Anti-inflammatory and anti-allergic effects of glucocorticoids" }, { text: "They induce lipocortin which inhibits phospholipase A2" },
  { text: "Q3 a) Patients with hypothyroidism cannot tolerate cold" }, { text: "T3 and T4 decrease, so basal metabolic rate decreases" },
  { text: "Q3 c) Maximum visual acuity is at the fovea centralis" }, { text: "The fovea has only cones and no rods" },
  { text: "Q4." }, { text: "1. (a) Bipolar neurons are capable of regeneration" } ] };

// A model that must never be asked to sort lines, and that fails for one question.
const grader = (failFor?: string) => async ({ content, system }: { content: unknown[]; system: string }) => {
  const text = (content as { text?: string }[]).map((c) => c.text ?? "").join("\n");
  assert.ok(!system.includes("sort lines"), "headings are enough, so no AI call is made to sort lines");
  if (failFor && text.includes(failFor)) throw new Error("AI service error 520: busy");
  const ids = [...text.matchAll(/- id (\S+):/g)].map((m) => m[1]);
  return JSON.stringify({ points: ids.map((id) => ({ id, marks_awarded: 0.5, quote: "x", line_index: 0, confidence: "high" })), diagram: { present: false }, terms_found: [], critical_error: { found: false } });
};

test("lines are sorted by their headings with no AI call, and the roll number line belongs to no answer", async () => {
  const r = await evaluateScript(grader(), [reading], qin);
  const by = (label: string) => r.transcript.filter((l) => l.question === label).map((l) => l.text);
  assert.equal(by("Question 2").length, 3); assert.equal(by("Question 2(e)").length, 2); assert.equal(by("Question 3(a)").length, 2);
  assert.equal(by("Question 3(c)").length, 2); assert.equal(by("Question 4").length, 2);
  assert.ok(!r.transcript.some((l) => l.question && l.text.startsWith("Roll No") && l.question !== "\u0000none"));
  assert.deepEqual(r.warnings, []);
});

test("one question that the AI cannot grade is left for the evaluator; the others are still graded", async () => {
  const events: string[] = [];
  const r = await evaluateScript(grader("fovea"), [reading], qin, (e) => events.push(e.type));
  assert.ok(r.warnings.some((w) => w.includes("Question 3(c)") && w.includes("by hand")));
  assert.ok(r.answers.q4 && r.answers.qath && r.answers.q3a);
  assert.equal(Object.values(r.answers.q3c.pointMarks).reduce((a, b) => a + b, 0), 0);
  assert.equal(events[0], "start"); assert.equal(events[1], "sorted");
  assert.equal(events.filter((e) => e === "graded").length, 4); assert.equal(events.filter((e) => e === "failed").length, 1);
});

test("the stream endpoint reports pages, sorting and each graded question, then the result", async () => {
  useSetup({ provider: "mistral", model: "fake", call: grader() as any, store: fileStore("/tmp/live-test-store.json"),
    ocr: async (pages, onPage) => { onPage?.(1, reading.lines); return [reading, ...pages.slice(1)]; } });
  const srv: Server = server; await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", () => ok()));
  const port = (srv.address() as any).port;
  const realFetch = globalThis.fetch; globalThis.fetch = ((u: any, i: any) => realFetch(String(u).startsWith("/") ? `http://127.0.0.1:${port}${u}` : u, i)) as any;
  try {
    const seen: string[] = [];
    const r = await scanStream([{ kind: "image", mediaType: "image/jpeg", data: "AA" }], questions, (e) => seen.push(e.type));
    assert.equal(seen[0], "start"); assert.ok(seen.includes("page")); assert.ok(seen.indexOf("sorted") > seen.indexOf("page"));
    assert.equal(seen.filter((e) => e === "graded").length, 5); assert.equal(Object.keys(r.answers).length, 5);
  } finally { globalThis.fetch = realFetch; srv.close(); }
});

test("the live view lights up lines, shows marks on graded evidence and lists each question", async () => {
  let s = liveStart(questions);
  const ev = (e: any) => (s = liveReduce(s, e));
  ev({ type: "start", pages: 1, questions: [] }); ev({ type: "page", page: 1, lines: [{ text: "Q2 e) x", y0: 0.1, y1: 0.15 }] });
  ev({ type: "sorted", lines: [{ page: 1, text: "Q2 e) x", question: "Question 2(e)", kind: "text", legible: true, y0: 0.1, y1: 0.15 }] });
  ev({ type: "grading", qid: "q2e" });
  const q = questions.find((x) => x.id === "q2e")!;
  const p = q.rubric.points[0];
  ev({ type: "graded", qid: "q2e", seconds: 4, findings: { pointMarks: { [p.id]: p.marks }, evidence: {}, diagram: { present: false, elementsFound: [] }, termsFound: [], criticalError: false, secondPassTotal: 0, transcript: [{ text: "Q2 e) x", pointId: p.id, page: 1, y0: 0.1, y1: 0.15 }] } });
  const html = renderToStaticMarkup(React.createElement(LiveScan, { state: s, images: ["data:image/png;base64,AA"], questions, running: true }));
  assert.match(html, /Question 2\(e\)/); assert.match(html, /1\.5\/1\.5/); assert.match(html, /Reading pages 1\/1/); assert.match(html, /Question 4/);
});
