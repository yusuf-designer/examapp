import { useState } from "react";
import { Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SimpleSelect } from "@/components/simple-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, PageHeader } from "@/components/shared";
import { WindowControl } from "@/components/WindowControl";
import { can } from "@/lib/permissions";
import { fmt } from "@/lib/rubric";
import { actions, runAction, userName, useApp, useMe } from "@/lib/store";
import { evalsOf, progress } from "@/lib/selectors";

export default function Results() {
  const s = useApp(); const me = useMe(); const exams = s.exams.filter((e) => !e.demoOnly && s.scripts.some((x) => x.examId === e.id)); const [examId, setExamId] = useState(exams[0]?.id ?? s.exams[0].id);
  const exam = exams.find((e) => e.id === examId) ?? exams[0] ?? s.exams[0]; const p = progress(s, exam);
  const assigned = s.assignedExamIds.includes(exam.id); const ev = evalsOf(s, exam);
  const [pick, setPick] = useState<Record<string, string>>({}); const [days] = useState(5);
  const examiners = [...new Set(ev.map((e) => e.examinerId))];
  const scripts = s.scripts.filter((x) => x.examId === exam.id);
  const Step = ({ done, label, hint, children }: { done: boolean; label: string; hint: string; children?: React.ReactNode }) => (
    <div className="flex items-start gap-3 border-b py-3 last:border-0">
      {done ? <Check className="mt-0.5 h-5 w-5 text-success" /> : <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />}
      <div className="flex-1"><div className="font-semibold">{label}</div><div className="text-sm text-muted-foreground">{hint}</div></div>{children}
    </div>
  );
  return (
    <>
      <PageHeader crumb="Admin portal / Results" title="Marking progress, publication and rechecks" sub={`${exam.subject} ${exam.paper} · ${exam.year}`} actions={exams.length > 1 ? <SimpleSelect label="Exam" className="w-56" value={exam.id} onValueChange={setExamId} options={exams.map((e) => ({ value: e.id, label: `${e.subject} ${e.paper}` }))} /> : undefined} />
      {!assigned ? <Empty>Scripts are not assigned yet. Go to Scripts to scan and assign them.</Empty> : (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Progress by examiner</CardTitle><CardDescription>{p.done} of {p.total} answers finalised · {p.flagged} still flagged for a closer look</CardDescription></CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Examiner</TableHead><TableHead>Assigned</TableHead><TableHead>Finalised</TableHead><TableHead>Changed AI marks</TableHead><TableHead>Second-marker sample</TableHead></TableRow></TableHeader>
                  <TableBody>{examiners.map((id) => { const mine = ev.filter((e) => e.examinerId === id); return (
                    <TableRow key={id}><TableCell className="font-semibold">{userName(s, id)}</TableCell><TableCell>{mine.length}</TableCell><TableCell>{mine.filter((e) => e.status === "finalised").length}</TableCell><TableCell>{mine.filter((e) => e.reason).length}</TableCell><TableCell>{mine.filter((e) => e.secondMarkerId).length}</TableCell></TableRow>); })}</TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Final marks (anonymous)</CardTitle></CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Script</TableHead>{exam.questions.map((q) => <TableHead key={q.id}>{q.label}</TableHead>)}<TableHead>Total</TableHead></TableRow></TableHeader>
                  <TableBody>{scripts.map((sc) => { const done = exam.questions.every((q) => sc.finalTotals[q.id] !== undefined); const tot = exam.questions.reduce((n, q) => n + (sc.finalTotals[q.id] ?? 0), 0); return (
                    <TableRow key={sc.id}><TableCell className="font-semibold">{sc.id}</TableCell>{exam.questions.map((q) => <TableCell key={q.id}>{sc.finalTotals[q.id] !== undefined ? `${fmt(sc.finalTotals[q.id])} / ${q.marks}` : <span className="text-muted-foreground">pending</span>}</TableCell>)}<TableCell className="font-semibold">{done ? `${fmt(tot)} / ${exam.questions.reduce((n, q) => n + q.marks, 0)}` : "—"}</TableCell></TableRow>); })}</TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recheck requests</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {s.rechecks.length === 0 && <p className="text-sm text-muted-foreground">No recheck requests yet.</p>}
                {s.rechecks.map((r) => { const q = exam.questions.find((x) => x.id === r.qid)!; const first = s.evaluations.find((e) => e.scriptId === r.scriptId && e.qid === r.qid)?.examinerId; const elig = exam.evaluators.filter((id) => id !== first && s.users.find((u) => u.id === id)?.department === exam.department); return (
                  <div key={r.id} className="space-y-2 rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{r.scriptId} · {q.label}</div><Badge variant={r.status === "decided" ? "success" : r.status === "assigned" ? "info" : "warning"}>{r.status}</Badge></div>
                    <p className="text-sm text-muted-foreground">{r.category}. “{r.comment}”</p>
                    {r.status === "submitted" && can(me, "assign_recheck", exam) && (
                      <div className="flex flex-wrap gap-2"><SimpleSelect label="Second evaluator" className="max-w-xs" placeholder="Choose second evaluator" value={pick[r.id] ?? ""} onValueChange={(v) => setPick({ ...pick, [r.id]: v })} options={elig.map((id) => ({ value: id, label: userName(s, id) }))} />
                        <Button onClick={() => runAction(() => actions.assignRecheck(r.id, pick[r.id] ?? ""), "Assigned.")}>Assign</Button></div>)}
                    {r.status === "assigned" && <p className="text-sm">Assigned to <b>{userName(s, r.assignedTo)}</b>.</p>}
                    {r.status === "decided" && <p className="text-sm"><b>{fmt(r.oldTotal)} to {fmt(r.newTotal ?? 0)}</b> · {userName(s, r.decidedBy)}: {r.decisionReason}</p>}
                  </div>); })}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Release steps</CardTitle></CardHeader>
              <CardContent>
                <Step done={p.done === p.total && p.total > 0} label="All answers finalised" hint={`${p.done} of ${p.total}`} />
                <Step done={!!exam.signedOffBy} label="Sign-off by the Admin" hint={exam.signedOffBy ? `Signed by ${userName(s, exam.signedOffBy)}` : "Required before publishing"}>
                  {!exam.signedOffBy && can(me, "signoff", exam) && <Button size="sm" onClick={() => runAction(() => actions.signOff(exam.id), "Signed off.")}>Sign off</Button>}</Step>
                <Step done={exam.published} label="Publish to students" hint={exam.published ? "Students can see their scripts" : `Opens a ${days}-day recheck window`}>
                  {!exam.published && can(me, "publish", exam) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="sm">Publish</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Publish results to students?</AlertDialogTitle><AlertDialogDescription>Every student will see their marks, their graded script and the reasons. The evaluation window closes and a {days}-day recheck window opens.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Not yet</AlertDialogCancel><AlertDialogAction onClick={() => runAction(() => actions.publishResults(exam.id, days), "Published. The recheck window is open.")}>Publish results</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>)}</Step>
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-base">Time windows</CardTitle></CardHeader><CardContent className="space-y-4"><WindowControl exam={exam} name="evaluation" /><WindowControl exam={exam} name="recheck" /></CardContent></Card>
          </div>
        </div>
      )}
    </>
  );
}
