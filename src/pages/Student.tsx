import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { BreakdownCard, DeductionList, Empty, PageHeader, WindowPill, when } from "@/components/shared";
import { AnswerScan, QuestionCard, ScriptView } from "@/components/ScriptView";
import { computeScore, fmt } from "@/lib/rubric";
import { actions, runAction, userName, useApp, useMe, windowStatus } from "@/lib/store";

const CATS = ["A point I wrote was not credited", "A deduction does not match the rules", "Marks were added up wrongly", "Something else"];
export default function Student() {
  const s = useApp(); const me = useMe(); const sc = s.scripts.find((x) => x.id === me.scriptId); const exam = sc && s.exams.find((e) => e.id === sc.examId);
  const [pickedQ, setQid] = useState(""); const qid = exam?.questions.some((x) => x.id === pickedQ) ? pickedQ : exam?.questions[0]?.id ?? ""; const [notes, setNotes] = useState<{ idx: number; pointId?: string; text: string }[]>([]);
  const [cat, setCat] = useState(CATS[0]); const [comment, setComment] = useState(""); const [claims, setClaims] = useState<Record<string, string>>({});
  useEffect(() => { setNotes([]); setComment(""); setClaims({}); }, [qid, me.id]);
  if (!sc || !exam) return <Empty>No script is linked to your account.</Empty>;
  if (!exam.published) return (<><PageHeader title="My graded script" sub={`${exam.subject} ${exam.paper}`} /><Alert><AlertTitle>Results are not published yet</AlertTitle><AlertDescription>You will see your marks, the reasons for them, and your scanned answers here once the examination office publishes results. Then a recheck window opens.</AlertDescription></Alert></>);
  const q = exam.questions.find((x) => x.id === qid); const f = sc.findings[qid];
  if (!q) return <Empty>This exam has no questions.</Empty>;
  const ev = s.evaluations.find((e) => e.id === `${sc.id}:${qid}`);
  if (!ev) return <Empty>Your marks for {q.label} are not ready yet.</Empty>; const rc = s.rechecks.find((r) => r.scriptId === sc.id && r.qid === qid);
  const input = rc?.status === "decided" && rc.decisionInput ? rc.decisionInput : ev.mine; const b = computeScore(q.rubric, input, q.marks);
  const total = exam.questions.reduce((n, x) => n + (sc.finalTotals[x.id] ?? 0), 0), max = exam.questions.reduce((n, x) => n + x.marks, 0);
  const win = windowStatus(exam, "recheck");
  const practise: string[] = [];
  q.rubric.points.forEach((p, i) => { const m = input.pointMarks[p.id] ?? 0; if (m < p.marks) practise.push(`Point ${i + 1}: ${p.text}. You earned ${fmt(m)} of ${fmt(p.marks)}.`); });
  if (q.rubric.diagram.required && b.diagram < b.diagramMax) { const miss = q.rubric.diagram.elements.filter((e) => !input.diagram.elementsFound.includes(e)); practise.push(miss.length ? `Diagram: add ${miss.join("; ")}.` : "Draw the diagram."); }
  b.missedTerms.forEach((t) => practise.push(`Use the term “${t}”.`));
  const toggleNote = (idx: number, pointId?: string) => setNotes((n) => (n.some((x) => x.idx === idx) ? n.filter((x) => x.idx !== idx) : [...n, { idx, pointId, text: "" }]));
  return (
    <>
      <PageHeader title="My graded script" sub={`${exam.subject} ${exam.paper} · ${me.name} · Roll ${me.rollNo}`}
        actions={<div className="text-right"><div className="text-sm text-muted-foreground">Total</div><div className="font-display text-4xl font-bold">{fmt(total)} <span className="text-lg font-medium text-muted-foreground">/ {max}</span></div></div>} />
      <Alert variant={win.open ? "warning" : "default"} className="mb-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><AlertTitle>{win.open ? "Recheck window is open" : "The recheck window is closed"}</AlertTitle><AlertDescription>{win.open ? "Pin notes on your script, then request a recheck. One request per question." : "You can still read your script and the reasons for each mark."}</AlertDescription></div><div className="min-w-[14rem]"><WindowPill exam={exam} name="recheck" /></div></div></Alert>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {exam.questions.map((x) => { const r = s.rechecks.find((y) => y.scriptId === sc.id && y.qid === x.id); return (
          <button key={x.id} onClick={() => setQid(x.id)} className={`rounded-xl border-2 bg-card p-4 text-left ${x.id === qid ? "border-primary" : "border-border"}`}>
            <div className="text-sm text-muted-foreground">{x.label}</div><div className="font-display text-2xl font-semibold">{fmt(sc.finalTotals[x.id] ?? 0)} / {x.marks}</div>
            {r && <Badge className="mt-1" variant={r.status === "decided" ? "success" : "info"}>Recheck {r.status}</Badge>}
          </button>); })}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>{q.label} · your answer</CardTitle><CardDescription>{win.open && !rc ? "Select any line to pin a note to it." : "Marks beside each point show what you earned."}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <QuestionCard q={q} /><AnswerScan scriptId={sc.id} f={f} rubric={q.rubric} marked={input.pointMarks} /><ScriptView demo={s.batches.find((x) => x.id === sc.batchId)?.synthetic !== false} f={{ ...f, pointMarks: input.pointMarks }} rubric={q.rubric} showMarks onLine={win.open && !rc ? toggleNote : undefined} noted={new Set(notes.map((n) => n.idx))} />
            {notes.map((n) => (
              <div key={n.idx} className="space-y-1.5 rounded-2xl bg-secondary p-3">
                <label className="text-sm font-semibold" htmlFor={`n${n.idx}`}>Your note on “{f.transcript[n.idx].text.slice(0, 48)}…”</label>
                <Textarea id={`n${n.idx}`} className="min-h-[64px]" value={n.text} onChange={(e) => setNotes((all) => all.map((x) => (x.idx === n.idx ? { ...x, text: e.target.value } : x)))} placeholder="For example: my diagram on page 6 shows this" />
              </div>))}
          </CardContent></Card>
        <div className="space-y-5">
          <BreakdownCard rubric={q.rubric} b={b} title={`Why you got ${fmt(b.total)} / ${q.marks}`} />
          <DeductionList rubric={q.rubric} input={input} evidence={f.evidence} b={b} claimsOpen={win.open && !rc} claims={claims} onClaim={(id, t) => setClaims((c) => ({ ...c, [id]: t }))} />
          {rc?.claims && rc.claims.length > 0 && <Card><CardHeader><CardTitle>Your own answers</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{rc.claims.map((c) => <div key={c.pointId} className="rounded-2xl bg-muted p-3"><div className="font-medium">{q.rubric.points.find((p) => p.id === c.pointId)?.text}</div><p className="mt-1 text-muted-foreground">{c.myAnswer}</p></div>)}</CardContent></Card>}
          {ev.reason && <Card><CardContent className="p-5 text-sm"><div className="font-semibold">Examiner’s note</div><p className="mt-1 text-muted-foreground">{ev.reason}</p></CardContent></Card>}
          {practise.length > 0 && <Card><CardHeader><CardTitle>What to practise next</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-1.5 pl-5 text-sm">{practise.map((p) => <li key={p}>{p}</li>)}</ul></CardContent></Card>}
          {rc ? (
            <Card><CardHeader><CardTitle>Your recheck request</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <Badge variant={rc.status === "decided" ? "success" : "info"}>{rc.status === "submitted" ? "Submitted, waiting for assignment" : rc.status === "assigned" ? "With a second evaluator" : "Decided"}</Badge>
              <p className="text-muted-foreground">Sent {when(rc.createdAt)} · “{rc.comment}” · {rc.notes.length} note(s)</p>
              {rc.status === "decided" && <div className="rounded-2xl bg-muted p-3"><b>{fmt(rc.oldTotal)} to {fmt(rc.newTotal ?? 0)}</b> · {userName(s, rc.decidedBy)}<p className="mt-1">{rc.decisionReason}</p></div>}
            </CardContent></Card>
          ) : (
            <Card><CardHeader><CardTitle>Request a recheck · {q.label}</CardTitle></CardHeader><CardContent className="space-y-4">
              <FieldSet><FieldLegend>What is the problem?</FieldLegend>
                <RadioGroup value={cat} onValueChange={setCat} disabled={!win.open}>
                  {CATS.map((c, i) => <div key={c} className="flex min-h-[40px] items-center gap-3"><RadioGroupItem id={`cat${i}`} value={c} /><Label htmlFor={`cat${i}`} className="font-normal">{c}</Label></div>)}
                </RadioGroup></FieldSet>
              <div className="space-y-1.5"><label htmlFor="cm" className="text-sm font-semibold">Explain in your own words</label><Textarea id="cm" disabled={!win.open} value={comment} onChange={(e) => setComment(e.target.value)} /><p className="text-sm text-muted-foreground">{notes.length} note(s) pinned to your script will be attached.</p></div>
              <Alert variant="warning">A second evaluator who has not seen your marks rechecks the whole question. Marks can go up, stay the same, or go down.</Alert>
              <Button disabled={!win.open} onClick={() => runAction(() => actions.submitRecheck(sc.id, qid, cat, comment, notes.filter((n) => n.text.trim()).map((n) => ({ pointId: n.pointId, text: n.text })), Object.entries(claims).filter(([, t]) => t.trim()).map(([pointId, myAnswer]) => ({ pointId, myAnswer }))), "Recheck request sent.")}>Submit recheck request</Button>
            </CardContent></Card>
          )}
        </div>
      </div>
    </>
  );
}
