import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, ScanText, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SimpleSelect } from "@/components/simple-select";
import { Field } from "@/components/shared";
import { getHealth, parseReading, prepareFiles, saveThumbs, scanScript, scanStream, type Health, type ScanPage } from "@/lib/api";
import { backend } from "@/lib/backend";
import { LiveScan, liveReduce, liveStart, type LiveState } from "@/components/LiveScan";
import { DEMO_STUDENT_IDS } from "@/lib/permissions";
import { actions, runAction, useApp } from "@/lib/store";
import type { Exam } from "@/lib/types";

export function ScanUpload({ exam, disabled }: { exam: Exam; disabled: boolean }) {
  const s = useApp();
  const [health, setHealth] = useState<Health | null>(null);
  const [files, setFiles] = useState<File[]>([]); const [typed, setTyped] = useState("");
  const [barcode, setBarcode] = useState(`PHY-${1300 + s.scripts.length}`); const [student, setStudent] = useState("none");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState<{ pages: number; warnings: string[]; mode: string } | null>(null);
  const [live, setLive] = useState<LiveState | null>(null); const [liveImages, setLiveImages] = useState<string[]>([]);
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => { getHealth().then(setHealth); }, []);
  const students = s.users.filter((u) => u.role === "student" && !DEMO_STUDENT_IDS.includes(u.id));
  const [stuName, setStuName] = useState(""); const [stuRoll, setStuRoll] = useState("");

  async function run() {
    setError(""); setDone(null); setBusy(true); setLive(null);
    try {
      const json = files.find((f) => f.name.toLowerCase().endsWith(".json") || f.type === "application/json");
      const reading = json ? await parseReading(json) : null;
      const imgs = files.filter((f) => f !== json);
      if (reading) { const order = reading.pages.map((p) => p.file).filter(Boolean) as string[]; const at = (f: File) => { const i = order.indexOf(f.name); return i < 0 ? 999 : i; }; imgs.sort((a, b) => at(a) - at(b)); }
      const prepared = imgs.length ? await prepareFiles(imgs, health?.maxBodyBytes ? Math.floor(health.maxBodyBytes * 0.7) : null) : { pages: [] as ScanPage[], thumbs: [] as string[] };
      const pages: ScanPage[] = [...(reading ? reading.pages.map((p) => ({ kind: "reading" as const, page: p.page, lines: p.lines })) : prepared.pages), ...(typed.trim() ? [{ kind: "text" as const, text: typed }] : [])];
      if (!pages.length) throw new Error("Choose at least one scanned page, or paste the answer text.");
      let r;
      if (backend.server) { setLiveImages(prepared.thumbs); setLive(liveStart(exam.questions)); r = await scanStream(pages, exam.questions, (e) => setLive((l) => (l ? liveReduce(l, e) : l))); }
      else r = await scanScript(pages, exam.questions);
      let ok = false;
      runAction(() => { actions.addScannedScript(exam.id, barcode, student === "none" || student === "new" ? "" : student, r.answers, pages.length, r.warnings, student === "new" ? { name: stuName, rollNo: stuRoll } : undefined); ok = true; }, `Script ${barcode} uploaded and read. Assign it to an evaluator next.`);
      if (ok) { saveThumbs(barcode.trim(), prepared.thumbs); setDone({ pages: pages.length, warnings: r.warnings, mode: r.mode }); setFiles([]); setTyped(""); setBarcode(`PHY-${1301 + s.scripts.length}`); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">AI reader</span>
        {health === null ? <Badge variant="muted">Checking…</Badge>
          : !health.reachable ? <Badge variant="destructive">Server not running</Badge>
          : health.ai === "live" ? <Badge variant="success">Live · {health.model}</Badge>
          : <Badge variant="warning">No API key · text only</Badge>}
      </div>
      {health && !health.reachable && <Alert variant="warning"><AlertDescription>Scanning needs the ExamEval server. Run <b>npm start</b> and open <b>http://localhost:5174</b>.</AlertDescription></Alert>}
      {health?.reachable && health.ai === "mock" && <Alert variant="warning"><AlertTitle>Handwriting cannot be read yet</AlertTitle><AlertDescription>Add ANTHROPIC_API_KEY to the .env file and restart. Until then you can paste typed answer text below to try the flow.</AlertDescription></Alert>}
      <input ref={pick} type="file" multiple accept="image/*,application/pdf,application/json,.json" className="hidden" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
      <button type="button" disabled={disabled || busy} onClick={() => pick.current?.click()} className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-border bg-muted/50 p-6 text-center text-sm transition-colors hover:bg-muted disabled:opacity-50">
        <ScanText className="h-6 w-6" /><span className="font-semibold">Choose scanned pages</span><span className="text-muted-foreground">Photos or a PDF of one student’s answer book. Add the reading.json from the OCR notebook too, if you have one.</span>
      </button>
      {files.length > 0 && <ul className="space-y-1 text-sm">{files.map((f, i) => (
        <li key={i} className="flex items-center justify-between gap-2 rounded-full bg-muted px-3 py-1.5"><span className="flex items-center gap-2 truncate"><FileText className="h-4 w-4 shrink-0" />{f.name}</span>
          <button type="button" aria-label={`Remove ${f.name}`} disabled={busy} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button></li>))}</ul>}
      <Field label="Or paste typed answer text" htmlFor="typed" hint="Start each answer with its question, for example “Question 3”."><Textarea id="typed" disabled={disabled || busy} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={"Question 3\nAtrial systole: the atria contract..."} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Barcode" htmlFor="bc"><Input id="bc" disabled={disabled || busy} value={barcode} onChange={(e) => setBarcode(e.target.value)} /></Field>
        <Field label="Student" htmlFor="stu"><SimpleSelect id="stu" label="Student" disabled={disabled || busy} value={student} onValueChange={setStudent} options={[{ value: "none", label: "Not matched" }, { value: "new", label: "Add a new student…" }, ...students.map((u) => ({ value: u.id, label: `${u.name} · ${u.rollNo}` }))]} /></Field>
      </div>
      {student === "new" && <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Student name" htmlFor="sn"><Input id="sn" value={stuName} onChange={(e) => setStuName(e.target.value)} disabled={disabled || busy} placeholder="Full name" /></Field>
        <Field label="Roll number" htmlFor="sr"><Input id="sr" value={stuRoll} onChange={(e) => setStuRoll(e.target.value)} disabled={disabled || busy} placeholder="2025-0501" /></Field>
        <p className="text-xs text-muted-foreground sm:col-span-2">The student signs in with the email made from the roll number, for example 20250501@students.jnmc-demo.edu.</p></div>}
      <Button className="w-full" size="lg" disabled={disabled || busy || !health?.reachable} onClick={run}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading and reading…</> : "Upload scan"}</Button>
      <p className="text-center text-sm text-muted-foreground">The AI reads the pages and proposes marks. Evaluators check and decide. You only upload and assign.</p>
      {live && <LiveScan state={live} images={liveImages} questions={exam.questions} running={busy} />}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {done && <Alert variant="success"><AlertTitle>{done.pages} page(s) uploaded and read</AlertTitle><AlertDescription>{done.warnings.length ? <ul className="list-disc pl-5">{done.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : "No problems found. The marks are ready for the evaluators."}</AlertDescription></Alert>}
    </div>
  );
}
