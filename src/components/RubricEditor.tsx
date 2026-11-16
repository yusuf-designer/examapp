import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { fmt, rubricAllocated, validateRubric } from "@/lib/rubric";
import type { Rubric } from "@/lib/types";

const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
function Lines({ value, onChange, disabled, id, rows = 4 }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean; id: string; rows?: number }) {
  const parse = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);
  const [raw, setRaw] = useState(value.join("\n"));
  useEffect(() => { if (JSON.stringify(parse(raw)) !== JSON.stringify(value)) setRaw(value.join("\n")); }, [value]); // eslint-disable-line
  return <Textarea id={id} rows={rows} disabled={disabled} value={raw} onChange={(e) => { setRaw(e.target.value); onChange(parse(e.target.value)); }} />;
}
function N({ id, label, value, onChange, disabled, step = 0.25 }: { id: string; label: string; value: number; onChange: (n: number) => void; disabled?: boolean; step?: number }) {
  return (
    <div className="space-y-1.5"><label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <Input id={id} type="number" min={0} step={step} value={value} disabled={disabled} onChange={(e) => onChange(num(e.target.value))} /></div>
  );
}

export function RubricEditor({ rubric, onChange, questionMarks, disabled }: { rubric: Rubric; onChange: (r: Rubric) => void; questionMarks: number; disabled?: boolean }) {
  const a = rubricAllocated(rubric); const errs = validateRubric(rubric, questionMarks);
  const set = (patch: Partial<Rubric>) => onChange({ ...rubric, ...patch });
  const setPoint = (i: number, patch: Partial<Rubric["points"][number]>) => set({ points: rubric.points.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-semibold">Model-answer points</h4>
        <div className="text-sm">Allocated <b className={errs.length ? "text-destructive" : "text-success"}>{fmt(a.total)} of {questionMarks}</b> · content {fmt(a.content)} · diagram {fmt(a.diagram)} · terminology {fmt(a.terminology)}</div>
      </div>
      <div className="space-y-3">
        {rubric.points.map((p, i) => (
          <div key={p.id} className="grid gap-3 rounded-2xl border bg-card p-3 md:grid-cols-[2rem_1fr_6rem_9.5rem_2.75rem] md:items-start">
            <div className="pt-3 text-sm text-muted-foreground">{i + 1}</div>
            <Textarea aria-label={`Point ${i + 1} text`} rows={2} className="min-h-[44px]" disabled={disabled} value={p.text} onChange={(e) => setPoint(i, { text: e.target.value })} placeholder="What the answer must say" />
            <Input aria-label={`Point ${i + 1} marks`} type="number" min={0} step={0.25} disabled={disabled} value={p.marks} onChange={(e) => setPoint(i, { marks: num(e.target.value) })} />
            <NativeSelect aria-label={`Point ${i + 1} type`} disabled={disabled} value={p.kind} onChange={(e) => setPoint(i, { kind: e.target.value as "content" | "deal_breaker" })}>
              <option value="content">Content</option><option value="deal_breaker">Deal-breaker</option>
            </NativeSelect>
            <Button variant="ghost" size="icon" aria-label={`Remove point ${i + 1}`} disabled={disabled} onClick={() => set({ points: rubric.points.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {!disabled && <Button variant="outline" onClick={() => set({ points: [...rubric.points, { id: `p${Date.now().toString(36)}`, text: "", marks: 1, kind: "content" }] })}><Plus className="h-4 w-4" />Add point</Button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between"><h4 className="text-base font-semibold">Diagram rule</h4>
            <label className="flex items-center gap-2 text-sm font-medium"><Switch disabled={disabled} checked={rubric.diagram.required} onCheckedChange={(v) => set({ diagram: { ...rubric.diagram, required: v, marks: v ? rubric.diagram.marks || 1 : 0 } })} aria-label="Diagram required" />Diagram required</label></div>
          {rubric.diagram.required ? (<>
            <div className="grid grid-cols-2 gap-3">
              <N id="dm" label="Diagram marks" value={rubric.diagram.marks} disabled={disabled} onChange={(n) => set({ diagram: { ...rubric.diagram, marks: n } })} />
              <N id="dmin" label="Elements needed for full marks" step={1} value={rubric.diagram.minElements} disabled={disabled} onChange={(n) => set({ diagram: { ...rubric.diagram, minElements: n } })} />
            </div>
            <div className="space-y-1.5"><label htmlFor="del" className="text-sm font-semibold">Required elements (one per line)</label>
              <Lines id="del" disabled={disabled} value={rubric.diagram.elements} onChange={(v) => set({ diagram: { ...rubric.diagram, elements: v } })} /></div>
            <p className="rounded-xl bg-muted p-3 text-sm">No diagram loses all {fmt(rubric.diagram.marks)}. Fewer than {rubric.diagram.minElements} elements loses half. {rubric.diagram.minElements} or more loses nothing.</p>
          </>) : <p className="text-sm text-muted-foreground">No marks are reserved for a diagram on this question.</p>}
        </div>
        <div className="space-y-4 rounded-2xl border bg-card p-4">
          <h4 className="text-base font-semibold">Terminology rule</h4>
          <div className="grid grid-cols-2 gap-3">
            <N id="tm" label="Terminology marks" value={rubric.terminology.marks} disabled={disabled} onChange={(n) => set({ terminology: { ...rubric.terminology, marks: n } })} />
            <N id="tp" label="Penalty per missed term" value={rubric.terminology.perTerm} disabled={disabled} onChange={(n) => set({ terminology: { ...rubric.terminology, perTerm: n } })} />
          </div>
          <div className="space-y-1.5"><label htmlFor="ttl" className="text-sm font-semibold">Required terms (one per line)</label>
            <Lines id="ttl" disabled={disabled} value={rubric.terminology.terms} onChange={(v) => set({ terminology: { ...rubric.terminology, terms: v } })} /></div>
          <p className="rounded-xl bg-muted p-3 text-sm">A plain-language description of the same idea still earns the content mark. Only this line loses. Losses stop at {fmt(rubric.terminology.marks)}.</p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-l-4 border-l-destructive bg-card p-4">
        <div className="flex items-center gap-2"><h4 className="text-base font-semibold">Caps</h4><Badge variant="destructive">Deal-breakers</Badge></div>
        <p className="text-sm text-muted-foreground">A cap is the most a student can score on this question, however many other points they earn; the lower cap wins if both apply.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <N id="c1" label="Cap if a deal-breaker point scores 0" value={rubric.caps.dealBreakerMissing} disabled={disabled} onChange={(n) => set({ caps: { ...rubric.caps, dealBreakerMissing: n } })} />
          <N id="c2" label="Cap if the answer states a critical error" value={rubric.caps.criticalError} disabled={disabled} onChange={(n) => set({ caps: { ...rubric.caps, criticalError: n } })} />
        </div>
      </div>
      {errs.length > 0 && <Alert variant="warning"><ul className="list-disc space-y-1 pl-5">{errs.map((e) => <li key={e}>{e}</li>)}</ul></Alert>}
    </div>
  );
}
