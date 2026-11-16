import { computeScore } from "./rubric";
import { flagsFor } from "./store";
import type { AppState, Evaluation, Exam } from "./types";

export function evalsOf(s: AppState, exam: Exam): Evaluation[] {
  const ids = new Set(s.scripts.filter((x) => x.examId === exam.id).map((x) => x.id));
  return s.evaluations.filter((e) => ids.has(e.scriptId));
}
export function progress(s: AppState, exam: Exam) {
  const ev = evalsOf(s, exam); const done = ev.filter((e) => e.status === "finalised").length;
  const flagged = ev.filter((e) => {
    const q = exam.questions.find((x) => x.id === e.qid)!; const f = s.scripts.find((x) => x.id === e.scriptId)!.findings[e.qid];
    return e.status === "pending" && flagsFor(e, f, q.rubric, q.marks).length > 0;
  }).length;
  return { total: ev.length, done, pct: ev.length ? Math.round((done / ev.length) * 100) : 0, flagged, scripts: s.scripts.filter((x) => x.examId === exam.id).length };
}
export function stage(s: AppState, exam: Exam): { label: string; tone: "muted" | "warning" | "success" | "info" | "destructive" } {
  if (exam.demoOnly) return { label: "Demo record", tone: "muted" };
  const p = progress(s, exam);
  if (exam.questions.some((q) => !q.locked)) return { label: "Scheme in draft", tone: "warning" };
  if (!p.scripts) return { label: "Upload scans", tone: "warning" };
  if (!s.assignedExamIds.includes(exam.id)) return { label: "Assign examiners", tone: "destructive" };
  if (exam.published) return { label: "Published", tone: "success" };
  if (p.done < p.total) return { label: "Marking", tone: "info" };
  if (!exam.signedOffBy) return { label: "Awaiting sign-off", tone: "warning" };
  return { label: "Ready to publish", tone: "success" };
}
export function aiTotal(s: AppState, e: Evaluation) {
  const sc = s.scripts.find((x) => x.id === e.scriptId)!; const exam = s.exams.find((x) => x.id === sc.examId)!; const q = exam.questions.find((x) => x.id === e.qid)!;
  return computeScore(q.rubric, sc.findings[e.qid], q.marks).total;
}
