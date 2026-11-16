import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BreakdownCard, DeductionList, Empty, PageHeader, useNav, WindowPill } from "@/components/shared";
import { MarksEditor } from "@/components/MarksEditor";
import { MarkSheet } from "@/components/MarkSheet";
import { AnswerScan, QuestionCard, ScriptView } from "@/components/ScriptView";
import { computeScore, diffInputs, fmt } from "@/lib/rubric";
import { actions, flagsFor, runAction, userName, useApp, useMe, windowStatus } from "@/lib/store";
import type { ScoreInput } from "@/lib/types";

export default function Review() {
  const s = useApp(); const me = useMe(); const { route, go } = useNav();
  const { scriptId, qid, recheckId } = route.params ?? {};
  const sc = s.scripts.find((x) => x.id === scriptId); const exam = sc && s.exams.find((e) => e.id === sc.examId); const q = exam?.questions.find((x) => x.id === qid);
  const ev = s.evaluations.find((e) => e.id === `${scriptId}:${qid}`); const rc = s.rechecks.find((r) => r.id === recheckId);
  const f = sc?.findings[qid ?? ""];
  const aiIn: ScoreInput | null = f ? { pointMarks: f.pointMarks, diagram: f.diagram, termsFound: f.termsFound, criticalError: f.criticalError } : null;
  const startIn = rc ? aiIn : ev?.mine ?? null;
  const [mine, setMine] = useState<ScoreInput | null>(startIn); const [reason, setReason] = useState(rc?.decisionReason ?? ev?.reason ?? "");
  useEffect(() => { setMine(rc ? (rc.decisionInput ?? aiIn) : ev?.mine ?? null); setReason(rc?.decisionReason ?? ev?.reason ?? ""); }, [scriptId, qid, recheckId]); // eslint-disable-line
  if (!sc || !exam || !q || !f || !aiIn || !mine || (!ev && !rc)) return <Empty>This item is not available.</Empty>;
  const isRecheck = !!rc;
  const winOpen = windowStatus(exam, "evaluation").open;
  const ro = isRecheck ? rc.status === "decided" || rc.assignedTo !== me.id : ev!.status === "finalised" || !winOpen || ev!.examinerId !== me.id;
  const ai = computeScore(q.rubric, aiIn, q.marks); const b = computeScore(q.rubric, mine, q.marks);
  const diffs = diffInputs(q.rubric, aiIn, mine); const flags = ev ? flagsFor(ev, f, q.rubric, q.marks) : [];
  const next = () => { const n = s.evaluations.find((e) => e.examinerId === me.id && e.status === "pending" && e.id !== ev?.id); n ? go("review", { scriptId: n.scriptId, qid: n.qid }) : go("review-list"); };
  return (
    <>
      <PageHeader crumb={isRecheck ? "Evaluator / Rechecks" : "Evaluator / My marking"} title={`Script ${sc.id} · ${q.label}`} sub="Name hidden. You see a barcode only."
        actions={<><div className="min-w-[14rem]">{!isRecheck && <WindowPill exam={exam} name="evaluation" />}</div><Button variant="outline" onClick={() => go(isRecheck ? "rechecks" : "review-list")}>Back to list</Button></>} />
      {!isRecheck && !winOpen && <Alert variant="warning" className="mb-4"><AlertTitle>The evaluation window is closed</AlertTitle><AlertDescription>You can read this answer but not change marks. Ask the Admin to extend the window.</AlertDescription></Alert>}
      {f.integrityNote && <Alert variant="destructive" className="mb-4"><AlertTitle>Integrity alert</AlertTitle><AlertDescription>{f.integrityNote} The AI’s marks above do not depend on it. Consider reporting it to the examination committee.</AlertDescription></Alert>}
      {isRecheck && (
        <Card className="mb-4 border-l-4 border-l-primary"><CardContent className="space-y-2 p-5 text-sm">
          <div className="font-semibold">Student’s recheck request</div><div>{rc.category}</div><p className="text-muted-foreground">“{rc.comment}”</p>
          {rc.notes.length > 0 && <ul className="list-disc pl-5">{rc.notes.map((n, i) => <li key={i}>{n.text}</li>)}</ul>}
          {rc.claims && rc.claims.length > 0 && (<div className="space-y-2"><div className="font-semibold">The student’s own answers for the points they dispute</div>
            {rc.claims.map((c) => { const idx = q.rubric.points.findIndex((p) => p.id === c.pointId); return <div key={c.pointId} className="rounded-2xl bg-muted p-3"><div className="font-medium">Point {idx + 1}: {q.rubric.points[idx]?.text}</div><p className="mt-1 text-muted-foreground">“{c.myAnswer}”</p></div>; })}</div>)}
          <div className="text-muted-foreground">{rc.status === "decided" ? `Original mark was ${fmt(rc.oldTotal)}.` : "The original mark is hidden until you decide, so you mark this fresh."}</div>
        </CardContent></Card>
      )}
      <div className="sticky top-0 z-20 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-baseline gap-3"><span className="font-display text-3xl font-bold tabular-nums">{fmt(b.total)}<span className="text-base font-medium text-muted-foreground"> / {q.marks}</span></span>
          <span className="text-sm text-muted-foreground">{diffs.length > 0 ? `You changed it. AI gave ${fmt(ai.total)}.` : isRecheck ? "AI’s marks, shown for you to decide." : "AI’s marks. Change them only if you disagree."}</span></div>
        <div className="flex flex-wrap items-center gap-2">
          {flags.length > 0 && <Badge variant="destructive" title={flags.join("\n")}>Look closely · {flags.length}</Badge>}
          {!ro && !isRecheck && <Button variant="outline" onClick={() => runAction(() => actions.saveEvaluation(ev!.id, mine, reason), "Draft saved.")}>Save draft</Button>}
          {!ro && (!isRecheck
            ? <Button onClick={() => { const ok = runAction(() => { actions.finaliseEvaluation(ev!.id, mine, reason); return true; }, "Finalised."); if (ok) next(); }}>{diffs.length ? "Finalise my marks and next" : "Agree and next"}</Button>
            : <Button onClick={() => { const ok = runAction(() => { actions.decideRecheck(rc!.id, mine, reason); return true; }, "Decision sent to the student."); if (ok) go("rechecks"); }}>Decide and reply</Button>)}
          {ro && !isRecheck && ev!.status === "finalised" && <Badge variant="success">Finalised {fmt(ev!.finalTotal ?? 0)} by {userName(s, ev!.examinerId)}</Badge>}
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <QuestionCard q={q} />
          <AnswerScan scriptId={sc.id} f={f} rubric={q.rubric} marked={mine.pointMarks} />
          <details className="rounded-2xl border bg-card px-4 py-3 text-sm"><summary className="cursor-pointer font-medium">Typed text of the answer</summary>
            <div className="mt-3"><ScriptView demo={s.batches.find((x) => x.id === sc.batchId)?.synthetic !== false} f={{ ...f, pointMarks: mine.pointMarks }} rubric={q.rubric} showMarks /></div></details>
        </div>
        <div className="space-y-3">
          {flags.length > 0 && <Alert variant="destructive"><AlertTitle>Look closely</AlertTitle><ul className="list-disc pl-5">{flags.map((x) => <li key={x}>{x}</li>)}</ul></Alert>}
          <MarkSheet rubric={q.rubric} input={mine} evidence={f.evidence} b={b} />
          {!ro && <details className="rounded-2xl border bg-card px-4 py-3 text-sm" open={diffs.length > 0}><summary className="cursor-pointer font-medium">Change the marks</summary>
            <div className="mt-3"><MarksEditor rubric={q.rubric} ai={f} value={mine} onChange={setMine} disabled={ro} /></div></details>}
          {(diffs.length > 0 || isRecheck) && <div className="space-y-2 rounded-2xl border border-l-4 border-l-warning bg-card p-4 text-sm">
            {diffs.length > 0 && <ul className="list-disc pl-5">{diffs.map((d) => <li key={d}>{d}</li>)}</ul>}
            <label htmlFor="why" className="font-semibold">{isRecheck ? "Reply to the student (required)" : "Reason for your changes (required)"}</label>
            <Textarea id="why" disabled={ro} value={reason} onChange={(e) => setReason(e.target.value)} /></div>}
          <details className="rounded-2xl border bg-card px-4 py-3 text-sm"><summary className="cursor-pointer font-medium">Full breakdown</summary>
            <div className="mt-3 space-y-3"><BreakdownCard rubric={q.rubric} b={b} /><DeductionList rubric={q.rubric} input={mine} evidence={f.evidence} b={b} /></div></details>
        </div>
      </div>
    </>
  );
}
