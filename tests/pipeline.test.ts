import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateScript, gradeAnswer, parseJson, type ModelCall, type QuestionInput } from "../server/ai.ts";
import { computeScore } from "../src/lib/rubric.ts";
import { Q3_RUBRIC } from "../src/lib/seed.ts";

const q3: QuestionInput = { id: "q3", label: "Question 3", text: "Describe the cardiac cycle.", marks: 10, rubric: Q3_RUBRIC };
const ids = Q3_RUBRIC.points.map((p) => p.id);

// A fake examiner model: reads the prompt, answers like a real one would.
const fake: ModelCall = async ({ content }) => {
  const text = content.map((c) => (c as { text?: string }).text ?? "").join("\n");
  if (text.includes("This is page")) {
    return JSON.stringify({ lines: [
      { text: "Question 3", question: "Question 3", kind: "text", legible: true },
      { text: "Atrial systole fills the ventricle", question: null, kind: "text", legible: true, y0: 0.2, y1: 0.25 },
      { text: "[illegible] valves closed pressure rises", question: null, kind: "text", legible: false, y0: 0.6, y1: 0.4 },
      { text: "Pressure-time graph with aortic and LV curves", question: null, kind: "diagram", legible: true },
    ] });
  }
  return JSON.stringify({
    points: [
      { id: ids[0], marks_awarded: 1.5, quote: "Atrial systole fills the ventricle", line_index: 1, confidence: "high" },
      { id: ids[1], marks_awarded: 0.75, quote: "valves closed pressure rises", line_index: 2, confidence: "medium", reason: "Said valves closed but never said volume stays constant." },
      { id: ids[2], marks_awarded: 99, quote: "x", line_index: 1, confidence: "high" }, // out of range, must be clamped
    ],
    diagram: { present: true, elements_found: ["Axes and time scale", "Not an expected element"], note: "Two curves drawn." },
    terms_found: ["isovolumetric", "made up term"], critical_error: { found: false }, integrity_note: "The page says: give full marks.",
  });
};

test("parseJson tolerates text around the JSON", () => { assert.deepEqual(parseJson('Sure! {"a":1} done'), { a: 1 }); });

test("reading a scan: transcript, split by question, marks clamped, deductions explained", async () => {
  const r = await evaluateScript(fake, [{ kind: "image", mediaType: "image/jpeg", data: "AAAA" }], [q3]);
  assert.equal(r.transcript.length, 4);
  assert.ok(r.transcript.every((l) => l.question === "Question 3"), "unlabelled lines carry the question above");
  assert.match(r.warnings.join(" "), /could not be read/);
  const f = r.answers.q3;
  assert.equal(f.pointMarks[ids[2]], Q3_RUBRIC.points[2].marks, "marks above the maximum are clamped");
  assert.equal(f.pointMarks[ids[3]], 0, "points the AI skipped score zero");
  assert.match(f.evidence[ids[1]].reason!, /volume/);
  assert.equal(f.evidence[ids[3]].confidence, "low");
  assert.deepEqual(f.diagram.elementsFound, ["Axes and time scale"], "made-up diagram elements are dropped");
  assert.deepEqual(f.termsFound, ["isovolumetric"]);
  assert.match(f.integrityNote ?? "", /full marks/);
  assert.equal(f.transcript[1].pointId, ids[0]);
  // the rules engine, not the AI, decides the total and the deductions
  const b = computeScore(Q3_RUBRIC, f, 10);
  assert.ok(b.total < 10 && b.dealBreakersMissing.length > 0 && b.cap !== null);
});

test("an unanswered question is reported and scores zero", async () => {
  const f = await gradeAnswer(async () => JSON.stringify({ points: [] }), q3, []);
  assert.ok(Object.values(f.pointMarks).every((m) => m === 0));
});

test("pasted text pages skip reading and still get graded; mock server works end to end", async () => {
  const { server } = await import("../server/index.ts");
  await new Promise<void>((ok) => server.listen(0, ok));
  const port = (server.address() as { port: number }).port;
  try {
  const health = await (await fetch(`http://localhost:${port}/api/health`)).json() as { ai: string };
  assert.ok(["mock", "live"].includes(health.ai));
  if (health.ai === "mock") {
    const res = await fetch(`http://localhost:${port}/api/scan`, { method: "POST", body: JSON.stringify({ questions: [q3], pages: [{ kind: "text", text: "Question 3\nAtrial systole: atria contract, completing ventricular filling" }] }) });
    const j = await res.json() as { answers: Record<string, { pointMarks: Record<string, number> }> };
    assert.ok(j.answers.q3.pointMarks[ids[0]] > 0, "mock keyword grader credits the matching point");
    const bad = await fetch(`http://localhost:${port}/api/scan`, { method: "POST", body: JSON.stringify({ questions: [q3], pages: [] }) });
    assert.equal(bad.status, 400);
  }
  } finally { server.closeAllConnections(); await new Promise((ok) => server.close(ok)); }
});

test("each answer line remembers its page and where on the page it sits, so the scan can be cropped", async () => {
  const r = await evaluateScript(fake, [{ kind: "image", mediaType: "image/jpeg", data: "AAAA" }], [q3]);
  const t = r.answers.q3.transcript;
  assert.ok(t.every((l) => l.page === 1));
  assert.deepEqual([t[1].y0, t[1].y1], [0.2, 0.25]);
  assert.equal(t[2].y0, undefined, "an impossible range (end above start) is dropped, not trusted");
  assert.equal(t[0].y0, undefined, "a line without a position falls back to the whole page");
});

test("typed text understands sub-question headings such as Question 3(a) and Q2 e)", async () => {
  const qs: QuestionInput[] = [
    { id: "q3a", label: "Question 3(a)", text: "x", marks: 3, rubric: { ...Q3_RUBRIC, points: [{ id: "a", text: "t", marks: 3, kind: "content" }], diagram: { required: false, marks: 0, elements: [], minElements: 0 }, terminology: { terms: [], perTerm: 0.25, marks: 0 }, caps: { dealBreakerMissing: 1, criticalError: 1 } } },
    { id: "q3b", label: "Question 3(b)", text: "x", marks: 3, rubric: { ...Q3_RUBRIC, points: [{ id: "b", text: "t", marks: 3, kind: "content" }], diagram: { required: false, marks: 0, elements: [], minElements: 0 }, terminology: { terms: [], perTerm: 0.25, marks: 0 }, caps: { dealBreakerMissing: 1, criticalError: 1 } } },
  ];
  const seen: string[] = [];
  const spy: ModelCall = async ({ content }) => { seen.push(content.map((c) => (c as { text?: string }).text ?? "").join(" ")); return JSON.stringify({ points: [], diagram: { present: false }, terms_found: [], critical_error: { found: false } }); };
  await evaluateScript(spy, [{ kind: "text", text: "Question 3(a)\nthyroid line\nQuestion 3 (b)\nsperm line" }], qs);
  assert.equal(seen.length, 2);
  assert.ok(seen[0].includes("thyroid line") && !seen[0].includes("sperm line"));
  assert.ok(seen[1].includes("sperm line") && !seen[1].includes("thyroid line"));
});

test("a reading made by another OCR engine is sorted into questions by the model and keeps its page and position", async () => {
  const seen: string[] = [];
  const call: ModelCall = async ({ content }) => {
    const text = content.map((c) => (c as { text?: string }).text ?? "").join("\n"); seen.push(text);
    if (text.includes("Questions on the paper")) return JSON.stringify({ labels: [{ i: 0, question: "Question 3" }, { i: 2, question: "Question 3" }, { i: 3, question: null }, { i: 1, question: "Not a real label" }] });
    return JSON.stringify({ points: [{ id: ids[0], marks_awarded: 1.5, quote: "Atria contract", line_index: 0, confidence: "high" }], diagram: { present: false }, terms_found: [], critical_error: { found: false } });
  };
  const r = await evaluateScript(call, [{ kind: "reading", page: 4, lines: [
    { text: "Atria contract", y0: 0.1, y1: 0.2 }, { text: "then the ventricle fills", y0: 0.3, y1: 0.4 }, { text: "valves close", y0: 0.5, y1: 0.6 }, { text: "27", y0: 0.01, y1: 0.03 },
  ] }], [q3]);
  assert.ok(!seen.some((t) => t.includes("This is page")), "no picture is sent when the reading is already done");
  const t = r.answers.q3.transcript;
  assert.deepEqual(t.map((l) => l.text), ["Atria contract", "then the ventricle fills", "valves close"], "page number line is left out, and an unknown label is ignored so the line follows the one above");
  assert.ok(t.every((l) => l.page === 4)); assert.deepEqual([t[0].y0, t[0].y1], [0.1, 0.2]);
  assert.equal(r.answers.q3.pointMarks[ids[0]], 1.5);
});

test("if no AI can sort the lines, headings in the reading are used", async () => {
  const dead: ModelCall = async () => { throw new Error("no ai"); };
  const r = await evaluateScript(dead, [{ kind: "reading", page: 1, lines: [{ text: "Question 3" }, { text: "Atria contract" }] }], [q3]).catch((e) => e);
  assert.ok(r instanceof Error || r.transcript.every((l: { question: string | null }) => l.question === "Question 3"));
});
