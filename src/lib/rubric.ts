import type { Breakdown, Rubric, ScoreInput } from "./types";

export const round025 = (n: number) => Math.round(n * 4) / 4;
export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

export function rubricAllocated(r: Rubric) {
  const content = r.points.reduce((s, p) => s + p.marks, 0);
  const diagram = r.diagram.required ? r.diagram.marks : 0;
  const terminology = r.terminology.terms.length ? r.terminology.marks : 0;
  return { content, diagram, terminology, total: content + diagram + terminology };
}

export function validateRubric(r: Rubric, questionMarks: number): string[] {
  const errs: string[] = [];
  if (!r.points.length) errs.push("Add at least one model-answer point.");
  r.points.forEach((p, i) => {
    if (!p.text.trim()) errs.push(`Point ${i + 1} has no text.`);
    if (!(p.marks > 0)) errs.push(`Point ${i + 1} needs marks above 0.`);
  });
  const a = rubricAllocated(r);
  if (Math.abs(a.total - questionMarks) > 1e-9) errs.push(`Marks allocated (${fmt(a.total)}) must equal the question total (${questionMarks}).`);
  if (r.diagram.required && r.diagram.elements.length === 0) errs.push("List the diagram elements the AI should look for.");
  if (r.diagram.required && r.diagram.minElements > r.diagram.elements.length) errs.push("Minimum diagram elements exceeds the list.");
  if (r.terminology.terms.length && r.terminology.perTerm * r.terminology.terms.length < r.terminology.marks - 1e-9)
    errs.push("Per-term penalty is too small to ever use all terminology marks. Raise it or add terms.");
  if (r.caps.dealBreakerMissing >= questionMarks || r.caps.criticalError >= questionMarks) errs.push("Caps must be below the question total.");
  return errs;
}

/**
 * The rubric engine. Pure and deterministic: same rubric + same findings => same marks.
 *  - content points: marks as reported, never above the point's maximum
 *  - diagram: absent => 0, present but fewer than minElements => half, otherwise full
 *  - terminology: allocation minus perTerm for each missed term, floored at 0
 *  - caps: a deal-breaker point scored 0 caps the question; a critical error caps it lower
 */
export function computeScore(r: Rubric, input: ScoreInput, questionMarks: number): Breakdown {
  let content = 0;
  const dealBreakersMissing: string[] = [];
  for (const p of r.points) {
    const m = Math.max(0, Math.min(p.marks, input.pointMarks[p.id] ?? 0));
    content += m;
    if (p.kind === "deal_breaker" && m === 0) dealBreakersMissing.push(p.id);
  }
  const a = rubricAllocated(r);

  let diagram = 0, diagramNote = "No diagram required";
  if (r.diagram.required) {
    const found = r.diagram.elements.filter((e) => input.diagram.elementsFound.includes(e)).length;
    if (!input.diagram.present) { diagram = 0; diagramNote = "No diagram"; }
    else if (found < r.diagram.minElements) { diagram = r.diagram.marks / 2; diagramNote = `${found} of ${r.diagram.elements.length} elements, needs ${r.diagram.minElements}`; }
    else { diagram = r.diagram.marks; diagramNote = `${found} of ${r.diagram.elements.length} elements`; }
  }

  let terminology = 0; let missedTerms: string[] = [];
  if (r.terminology.terms.length) {
    missedTerms = r.terminology.terms.filter((t) => !input.termsFound.includes(t));
    terminology = Math.max(0, r.terminology.marks - missedTerms.length * r.terminology.perTerm);
  }

  const raw = content + diagram + terminology;
  let cap: number | null = null; let capReason = "";
  if (input.criticalError) { cap = r.caps.criticalError; capReason = "Critical error stated"; }
  if (dealBreakersMissing.length) {
    if (cap === null || r.caps.dealBreakerMissing < cap) { cap = r.caps.dealBreakerMissing; capReason = "Deal-breaker point missing"; }
  }
  const capped = cap === null ? raw : Math.min(raw, cap);
  const total = Math.max(0, Math.min(questionMarks, round025(capped)));
  return {
    content, contentMax: a.content, diagram, diagramMax: a.diagram, diagramNote,
    terminology, terminologyMax: a.terminology, missedTerms, dealBreakersMissing,
    criticalError: input.criticalError, cap, capReason, raw, total, max: questionMarks,
  };
}

/** Human-readable list of what an examiner changed compared with the AI proposal. */
export function diffInputs(r: Rubric, ai: ScoreInput, mine: ScoreInput): string[] {
  const out: string[] = [];
  r.points.forEach((p, i) => {
    const a = ai.pointMarks[p.id] ?? 0, m = mine.pointMarks[p.id] ?? 0;
    if (a !== m) out.push(`Point ${i + 1}: ${fmt(a)} to ${fmt(m)}`);
  });
  if (ai.diagram.present !== mine.diagram.present) out.push(`Diagram: ${ai.diagram.present ? "present" : "absent"} to ${mine.diagram.present ? "present" : "absent"}`);
  const dAdd = mine.diagram.elementsFound.filter((e) => !ai.diagram.elementsFound.includes(e));
  const dDel = ai.diagram.elementsFound.filter((e) => !mine.diagram.elementsFound.includes(e));
  if (dAdd.length) out.push(`Diagram elements added: ${dAdd.join(", ")}`);
  if (dDel.length) out.push(`Diagram elements removed: ${dDel.join(", ")}`);
  const tAdd = mine.termsFound.filter((e) => !ai.termsFound.includes(e));
  const tDel = ai.termsFound.filter((e) => !mine.termsFound.includes(e));
  if (tAdd.length) out.push(`Terms credited: ${tAdd.join(", ")}`);
  if (tDel.length) out.push(`Terms removed: ${tDel.join(", ")}`);
  if (ai.criticalError !== mine.criticalError) out.push(`Critical error: ${ai.criticalError ? "yes" : "no"} to ${mine.criticalError ? "yes" : "no"}`);
  return out;
}

export function rubricDiff(a: Rubric, b: Rubric): string[] {
  const out: string[] = [];
  const ids = new Set([...a.points.map((p) => p.id), ...b.points.map((p) => p.id)]);
  ids.forEach((id) => {
    const x = a.points.find((p) => p.id === id), y = b.points.find((p) => p.id === id);
    if (!x && y) out.push(`Added point: ${y.text} (${fmt(y.marks)})`);
    else if (x && !y) out.push(`Removed point: ${x.text}`);
    else if (x && y) {
      if (x.text !== y.text) out.push(`Reworded point: “${x.text}” to “${y.text}”`);
      if (x.marks !== y.marks) out.push(`Marks for “${y.text.slice(0, 40)}”: ${fmt(x.marks)} to ${fmt(y.marks)}`);
      if (x.kind !== y.kind) out.push(`“${y.text.slice(0, 40)}” is now ${y.kind === "deal_breaker" ? "a deal-breaker" : "ordinary content"}`);
    }
  });
  if (JSON.stringify(a.diagram) !== JSON.stringify(b.diagram)) out.push("Diagram rule changed");
  if (JSON.stringify(a.terminology) !== JSON.stringify(b.terminology)) out.push("Terminology rule changed");
  if (JSON.stringify(a.caps) !== JSON.stringify(b.caps)) out.push("Caps changed");
  return out;
}
