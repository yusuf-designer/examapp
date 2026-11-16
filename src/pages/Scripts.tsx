import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { SimpleSelect } from "@/components/simple-select";
import { Field, PageHeader } from "@/components/shared";
import { can } from "@/lib/permissions";
import { actions, runAction, userName, useApp, useMe } from "@/lib/store";
import { ScanUpload } from "@/components/ScanUpload";
import { evalsOf } from "@/lib/selectors";

const STEPS = ["Choose the exam", "Upload answer books", "Choose who marks what", "Check and send"];

export default function Scripts() {
  const s = useApp(); const me = useMe();
  const exams = s.exams.filter((e) => !e.demoOnly && (me.role !== "hod" || e.department === me.department));
  const [examId, setExamId] = useState(exams[0]?.id ?? ""); const exam = exams.find((e) => e.id === examId) ?? exams[0];
  const [step, setStep] = useState(0);
  const [count, setCount] = useState(6);
  const [mode, setMode] = useState<"by_question" | "by_script">("by_question");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [pct, setPct] = useState(10); const [days, setDays] = useState(7);
  if (!exam) return <PageHeader crumb="Admin portal / Scripts" title="Scan and assign scripts" sub="There is no exam to scan yet." />;

  const pool = exam.evaluators.filter((id) => s.users.find((u) => u.id === id)?.department === exam.department);
  const byQ: Record<string, string> = {}; exam.questions.forEach((q, i) => { byQ[q.id] = picked[`${exam.id}:${q.id}`] ?? pool[i % Math.max(1, pool.length)] ?? ""; });
  const assigned = s.assignedExamIds.includes(exam.id);
  const scripts = s.scripts.filter((x) => x.examId === exam.id);
  const unlocked = exam.questions.filter((q) => !q.locked);
  const allLocked = exam.questions.length > 0 && unlocked.length === 0;
  const canUpload = can(me, "upload_scans", exam), canAssign = can(me, "assign_scripts", exam);
  const load: Record<string, number> = {};
  evalsOf(s, exam).forEach((e) => (load[e.examinerId] = (load[e.examinerId] ?? 0) + 1));
  const preview: Record<string, number> = {};
  if (!assigned && pool.length) exam.questions.forEach((q, qi) => scripts.forEach((_, si) => { const id = mode === "by_question" ? byQ[q.id] : pool[(si + qi) % pool.length]; if (id) preview[id] = (preview[id] ?? 0) + 1; }));
  const shown = assigned ? load : preview; const max = Math.max(1, ...Object.values(shown));
  const everyoneChosen = mode === "by_script" ? pool.length > 0 : exam.questions.every((q) => byQ[q.id]);
  const canNext = [allLocked && !assigned, scripts.length > 0, everyoneChosen, false][step];
  const why = [!allLocked ? `Waiting for the evaluators to lock: ${unlocked.map((q) => q.label).join(", ")}.` : "", scripts.length === 0 ? "Upload at least one answer book to continue." : "", everyoneChosen ? "" : "Choose an examiner for every question.", ""][step];

  const Workload = () => (
    <div className="space-y-3">
      <div className="text-sm font-semibold">{assigned ? "Answers each examiner marks" : "Answers each examiner will get"}</div>
      {Object.entries(shown).map(([id, n]) => (
        <div key={id} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm"><span>{userName(s, id)}</span>
          <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-accent" style={{ width: `${(n / max) * 100}%` }} /></div><span className="text-right font-semibold">{n}</span></div>
      ))}
      {Object.keys(shown).length === 0 && <p className="text-sm text-muted-foreground">Nothing to show yet.</p>}
    </div>
  );

  return (
    <>
      <PageHeader crumb="Admin portal / Scripts" title="Scan and assign scripts" sub="Four short steps, one after the other. Names are replaced by a barcode before any examiner sees a script." />
      {!canUpload && !canAssign && <Alert variant="warning" className="mb-6"><AlertTitle>Read-only for your role</AlertTitle><AlertDescription>Only the Admin and the Head of Department scan and assign scripts.</AlertDescription></Alert>}

      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((t, i) => {
          const done = assigned || i < step; const here = !assigned && i === step;
          return (<li key={t}><button type="button" disabled={!done || assigned} onClick={() => setStep(i)} aria-current={here ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${here ? "bg-primary text-primary-foreground" : done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-xs ${here ? "bg-primary-foreground/20" : done ? "bg-success/20" : "bg-background"}`}>{done ? <Check className="h-3 w-3" /> : i + 1}</span>{t}</button></li>);
        })}
      </ol>

      <Card className="max-w-3xl"><CardContent className="space-y-6 py-6">
        {assigned ? (<>
          <div><h2 className="text-xl font-semibold">All done. Scripts are with the examiners.</h2><p className="mt-1 text-sm text-muted-foreground">{exam.subject} {exam.paper} · {scripts.length} scripts. You can watch their progress under Results.</p></div>
          <Workload />
          <div className="flex flex-wrap gap-2 border-t pt-4"><SimpleSelect label="Exam" className="w-72" value={exam.id} onValueChange={(v) => { setExamId(v); setStep(0); }} options={exams.map((e) => ({ value: e.id, label: `${e.subject} ${e.paper}` }))} /></div>
        </>) : (<>
          <div><div className="text-sm text-muted-foreground">Step {step + 1} of 4</div><h2 className="text-xl font-semibold">{STEPS[step]}</h2></div>

          {step === 0 && (<div className="space-y-4">
            <Field label="Which exam are these answer books for?" htmlFor="exam"><SimpleSelect id="exam" label="Exam" value={exam.id} onValueChange={(v) => { setExamId(v); }} options={exams.map((e) => ({ value: e.id, label: `${e.subject} ${e.paper} · ${e.year}` }))} /></Field>
            <div className="space-y-2"><div className="text-sm font-semibold">Marking scheme</div>
              {exam.questions.map((q) => (<div key={q.id} className="flex items-center justify-between rounded-2xl bg-muted px-4 py-2.5 text-sm"><span>{q.label} · {q.marks} marks</span>{q.locked ? <Badge variant="success">Locked</Badge> : <Badge variant="warning">Evaluator still writing</Badge>}</div>))}
              {exam.questions.length === 0 && <p className="text-sm text-muted-foreground">This exam has no questions yet.</p>}</div>
            {!allLocked && <Alert variant="warning"><AlertDescription>Evaluators write the questions and marking scheme and lock it. You can continue once every question is locked.</AlertDescription></Alert>}
          </div>)}

          {step === 1 && (<div className="space-y-5">
            <ScanUpload exam={exam} disabled={!canUpload} />
            <div className="rounded-2xl bg-muted px-4 py-3 text-sm">
              <div className="font-semibold">{scripts.length} {scripts.length === 1 ? "script" : "scripts"} uploaded for this exam</div>
              {scripts.length > 0 && <div className="mt-1 flex flex-wrap gap-1.5">{[...scripts].reverse().slice(0, 12).map((x) => <Badge key={x.id} variant="muted">{x.id}</Badge>)}{scripts.length > 12 && <span className="text-muted-foreground">and {scripts.length - 12} more</span>}</div>}
            </div>
            <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Add demo scripts instead</summary>
              <div className="mt-3 flex items-end gap-2"><Input aria-label="Number of demo scripts" type="number" min={1} max={24} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-24" />
                <Button variant="outline" disabled={!canUpload} onClick={() => runAction(() => actions.uploadBatch(exam.id, count), "Demo scripts added.")}>Add demo scripts</Button></div></details>
          </div>)}

          {step === 2 && (<div className="space-y-5">
            {pool.length === 0 && <Alert variant="warning"><AlertDescription>No evaluator from {exam.department} is assigned to this exam yet.</AlertDescription></Alert>}
            <RadioGroup className="grid gap-3" value={mode} onValueChange={(v) => setMode(v as "by_question" | "by_script")}>
              {([["by_question", "By question", "Each examiner marks one question for all students. Strict or lenient marking affects everyone equally. Recommended."], ["by_script", "By script", "Each examiner marks whole answer books. Simpler, but a strict or lenient examiner only affects their own students."]] as const).map(([k, t, d]) => (
                <Label key={k} htmlFor={`mode-${k}`} className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-card p-4 font-normal transition-colors ${mode === k ? "border-primary" : "border-border hover:border-primary/40"}`}>
                  <RadioGroupItem id={`mode-${k}`} value={k} className="mt-1" />
                  <span><span className="mb-0.5 flex items-center gap-2 font-semibold">{t}{k === "by_question" && <Badge variant="success">Recommended</Badge>}</span><span className="block text-sm text-muted-foreground">{d}</span></span>
                </Label>))}
            </RadioGroup>
            {mode === "by_question" && (<div className="space-y-3">
              {exam.questions.map((q) => (
                <div key={q.id} className="grid items-center gap-2 sm:grid-cols-[1fr_16rem]">
                  <div><div className="font-semibold">{q.label} · {q.marks} marks</div><div className="text-sm text-muted-foreground">{q.type}</div></div>
                  <SimpleSelect label={`Examiner for ${q.label}`} placeholder="Choose examiner" value={byQ[q.id] ?? ""} disabled={!canAssign} onValueChange={(v) => setPicked({ ...picked, [`${exam.id}:${q.id}`]: v })} options={pool.map((id) => ({ value: id, label: userName(s, id) }))} />
                </div>))}
            </div>)}
            <Workload />
          </div>)}

          {step === 3 && (<div className="space-y-5">
            <dl className="grid gap-2 rounded-2xl bg-muted p-4 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">Exam</dt><dd className="font-medium">{exam.subject} {exam.paper}</dd>
              <dt className="text-muted-foreground">Answer books</dt><dd className="font-medium">{scripts.length}</dd>
              <dt className="text-muted-foreground">Split</dt><dd className="font-medium">{mode === "by_question" ? "By question" : "By script"}</dd>
              <dt className="text-muted-foreground">Examiners</dt><dd className="font-medium">{mode === "by_question" ? exam.questions.map((q) => `${q.label}: ${userName(s, byQ[q.id])}`).join(" · ") : pool.map((id) => userName(s, id)).join(", ")}</dd>
            </dl>
            <Field label={`Second-marker sample: ${pct}% of answers`} htmlFor="pct" hint="A share of answers is also marked by a second person, chosen at random."><Slider id="pct" aria-label="Second-marker sample" min={0} max={30} step={5} value={[pct]} disabled={!canAssign} onValueChange={(v) => setPct(v[0])} /></Field>
            <Field label="Examiners must finish within" htmlFor="days"><SimpleSelect id="days" label="Examiners must finish within" disabled={!canAssign} value={String(days)} onValueChange={(v) => setDays(parseInt(v))} options={[{ value: "5", label: "5 days" }, { value: "7", label: "7 days" }, { value: "10", label: "10 days" }]} /></Field>
            <Button className="w-full" size="lg" disabled={!canAssign || !allLocked || scripts.length === 0} onClick={() => runAction(() => actions.assignScripts(exam.id, mode, byQ, pct, days), "Scripts assigned. The evaluation window is open.")}>Assign and notify examiners</Button>
          </div>)}

          {why && !canNext && step < 3 && <p className="text-sm text-muted-foreground">{why}</p>}
          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" />Back</Button>
            {step < 3 && <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Next<ArrowRight className="h-4 w-4" /></Button>}
          </div>
        </>)}
      </CardContent></Card>
    </>
  );
}
