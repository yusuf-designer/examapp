import { useEffect, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleSelect } from "@/components/simple-select";
import { Textarea } from "@/components/ui/textarea";
import { Empty, Field, PageHeader, when } from "@/components/shared";
import { RubricEditor } from "@/components/RubricEditor";
import { WindowControl } from "@/components/WindowControl";
import { can } from "@/lib/permissions";
import { rubricAllocated, rubricDiff, fmt, validateRubric } from "@/lib/rubric";
import { actions, getState, impactOf, runAction, userName, useApp, useMe, windowStatus } from "@/lib/store";
import type { Rubric } from "@/lib/types";


export default function Schemes() {
  const s = useApp(); const me = useMe();
  const exams = s.exams.filter((e) => !e.demoOnly && (me.role === "evaluator" ? e.evaluators.includes(me.id) : me.role === "hod" ? e.department === me.department : true));
  const [examId, setExamId] = useState(exams[0]?.id ?? ""); const exam = exams.find((e) => e.id === examId) ?? exams[0];
  const [qid, setQid] = useState(exam?.questions[0]?.id ?? ""); const q = exam?.questions.find((x) => x.id === qid) ?? exam?.questions[0];
  const [text, setText] = useState(q?.text ?? ""); const [rubric, setRubric] = useState<Rubric>(q?.rubric ?? ({} as Rubric));
  const [reqOpen, setReqOpen] = useState(false); const [reason, setReason] = useState("");
  useEffect(() => { if (q) { setText(q.text); setRubric(structuredClone(q.rubric)); } }, [q?.id, q?.version, q?.locked, examId]); // eslint-disable-line
  const pending = s.editRequests.find((r) => exam && r.examId === exam.id && r.qid === q?.id && r.status === "pending");
  const entryOpen = exam ? windowStatus(exam, "entry").open : false;
  const isOwner = me.role === "evaluator" && !!exam && exam.evaluators.includes(me.id);
  const canEdit = !!exam && !!q && !q.locked && isOwner && entryOpen;
  const canLock = canEdit;
  const canRequest = !!exam && !!q?.locked && isOwner;
  const errs = q ? validateRubric(rubric, q.marks) : [];
  if (!exam || !q) return <Empty>No exams are available to you yet.</Empty>;
  const proposedDiff = reqOpen ? rubricDiff(q.rubric, rubric) : [];
  const impact = reqOpen ? impactOf(getState(), exam.id, q.id, rubric).length : 0;
  return (
    <>
      <PageHeader crumb="Marking schemes" title="Marking scheme and rubric" sub="Write what a correct answer must contain, how marks are split, and what happens when something is missing. Locking freezes it for everyone." />
      <div className="mb-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-4">
          <Card><CardContent className="space-y-3 p-4">
            <Field label="Exam" htmlFor="exs"><SimpleSelect id="exs" label="Exam" value={exam.id} onValueChange={(v) => { setExamId(v); const ne = exams.find((x) => x.id === v)!; setQid(ne.questions[0]?.id ?? ""); }} options={exams.map((e) => ({ value: e.id, label: `${e.subject} ${e.paper}` }))} /></Field>
            <div className="space-y-1">{exam.questions.map((x) => (
              <button key={x.id} onClick={() => setQid(x.id)} className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm ${x.id === q.id ? "bg-secondary" : "hover:bg-muted"}`}>
                <span><span className="block font-semibold">{x.label}</span><span className="text-muted-foreground">{x.marks} marks · {x.type}</span></span>
                {x.locked ? <Badge variant="success">v{x.version}</Badge> : <Badge variant="warning">Draft</Badge>}
              </button>))}</div>
          </CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Time windows</CardTitle></CardHeader><CardContent className="space-y-4"><WindowControl exam={exam} name="entry" /><WindowControl exam={exam} name="evaluation" /><WindowControl exam={exam} name="recheck" /></CardContent></Card>
        </div>
        <Tabs defaultValue="scheme" className="min-w-0">
          <TabsList><TabsTrigger value="scheme">Scheme</TabsTrigger><TabsTrigger value="history">History ({q.history.length})</TabsTrigger></TabsList>
          <TabsContent value="scheme">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{q.label} · {q.marks} marks</CardTitle>
                <div className="flex flex-wrap items-center gap-2">{canRequest && !pending && <Button size="sm" onClick={() => setReqOpen(true)}><Pencil className="h-4 w-4" />Request an edit</Button>}
                {q.locked ? <Badge variant="success"><Lock className="mr-1 h-3 w-3" />Locked v{q.version} · {when(q.lockedAt)} by {userName(s, q.lockedBy)}</Badge> : <Badge variant="warning">Draft · evaluator has not submitted</Badge>}</div></div>
              {!q.locked && me.role === "evaluator" && <CardDescription>{entryOpen ? "You can write and submit this scheme while the entry window is open. Submitting locks it." : "The entry window is closed. Ask the admin to open it."}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-6">
              {!isOwner && <Alert><AlertTitle>Read only</AlertTitle><AlertDescription>Evaluators write the question, the answer key and the rubric, and submitting locks it. Changes after that go through an evaluator’s edit request.</AlertDescription></Alert>}
              <Field label="Question text" htmlFor="qt"><Textarea id="qt" disabled={!canEdit} value={text} onChange={(e) => setText(e.target.value)} /></Field>
              {q.modelAnswer && (
                <div className="rounded-2xl border bg-muted/40 p-4" data-testid="expected-answer">
                  <div className="mb-1 text-sm font-semibold">Expected answer</div>
                  <p className="text-sm leading-relaxed">{q.modelAnswer}</p>
                  <div className="mt-3 overflow-hidden rounded-xl border bg-background text-sm">
                    <div className="grid grid-cols-[3rem_1fr_4rem] gap-2 border-b bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>No.</span><span>Marks are given for</span><span className="text-right">Marks</span></div>
                    {q.rubric.points.map((p, i) => (<div key={p.id} className="grid grid-cols-[3rem_1fr_4rem] gap-2 border-b px-3 py-2 last:border-0"><span className="text-muted-foreground">{i + 1}</span><span>{p.text}{p.kind === "deal_breaker" && <Badge variant="warning" className="ml-2">Must have</Badge>}</span><span className="text-right font-medium">{fmt(p.marks)}</span></div>))}
                    {q.rubric.terminology.terms.length > 0 && <div className="grid grid-cols-[3rem_1fr_4rem] gap-2 border-t px-3 py-2"><span className="text-muted-foreground">+</span><span>Key terms: {q.rubric.terminology.terms.join(", ")}</span><span className="text-right font-medium">{fmt(q.rubric.terminology.marks)}</span></div>}
                    <div className="grid grid-cols-[3rem_1fr_4rem] gap-2 border-t bg-muted px-3 py-2 font-semibold"><span /><span>Total</span><span className="text-right">{fmt(rubricAllocated(q.rubric).total)} / {q.marks}</span></div>
                  </div>
                </div>)}
              <RubricEditor rubric={rubric} onChange={setRubric} questionMarks={q.marks} disabled={!canEdit} />
              {pending && <Alert variant="warning"><AlertTitle>Edit request pending</AlertTitle><AlertDescription>Requested by {userName(s, pending.requestedBy)}. The Admin will decide. See Edit requests.</AlertDescription></Alert>}
              <div className="flex flex-wrap gap-3">
                {canEdit && <Button variant="outline" onClick={() => runAction(() => actions.saveDraft(exam.id, q.id, text, rubric), "Draft saved.")}>Save draft</Button>}
                {canEdit && canLock && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button disabled={errs.length > 0}>Submit and lock</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Lock {q.label}?</AlertDialogTitle><AlertDialogDescription>Locking freezes the question, the rubric and the caps as version {q.version + 1}. After this, changes need a written request that the Admin approves. The lock is recorded in the audit trail.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => runAction(() => actions.lockQuestion(exam.id, q.id, text, rubric), `${q.label} locked.`)}>Lock scheme</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>)}
              </div>
            </CardContent>
          </Card>
          </TabsContent>
          <TabsContent value="history">
          {q.history.length === 0 && <Empty>No locked versions yet. The first lock creates v1.</Empty>}
          {q.history.length > 0 && (
            <Card><CardHeader><CardTitle>Version history</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              {[...q.history].reverse().map((h) => (<div key={h.version} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0"><span className="font-semibold">v{h.version}</span><span className="text-muted-foreground">{when(h.lockedAt)} · {userName(s, h.lockedBy)} · {fmt(rubricAllocated(h.rubric).total)} marks allocated</span></div>))}
            </CardContent></Card>
          )}
          </TabsContent>
        </Tabs>
      </div>
      <Sheet open={reqOpen} onOpenChange={setReqOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Request an edit to {q.label}</SheetTitle><SheetDescription>Change the scheme below, then explain why. Nothing changes until the Admin approves.</SheetDescription></SheetHeader>
          <Field label="Question text" htmlFor="rqt"><Textarea id="rqt" value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <RubricEditor rubric={rubric} onChange={setRubric} questionMarks={q.marks} />
          <div className="rounded-2xl bg-muted p-4 text-sm"><b>What changes:</b> {proposedDiff.length || text !== q.text ? <ul className="mt-1 list-disc pl-5">{proposedDiff.map((d) => <li key={d}>{d}</li>)}{text !== q.text && <li>Question wording</li>}</ul> : " nothing yet"}
            <div className="mt-2"><b>Impact:</b> {impact} marked answer(s) would be sent back for re-review. Re-marking applies to every script so nobody is treated differently.</div></div>
          <Field label="Why is this edit needed? (required)" htmlFor="rr"><Textarea id="rr" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <SheetFooter><Button variant="outline" onClick={() => { setReqOpen(false); setRubric(structuredClone(q.rubric)); setText(q.text); }}>Cancel</Button>
            <Button onClick={() => { const ok = runAction(() => { actions.requestEdit(exam.id, q.id, rubric, text, reason); return true; }, "Edit request sent."); if (ok) { setReqOpen(false); setReason(""); setRubric(structuredClone(q.rubric)); setText(q.text); } }}>Send request</Button></SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
