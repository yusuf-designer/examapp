import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmt } from "@/lib/rubric";
import type { Findings, Rubric, ScoreInput } from "@/lib/types";

const confVariant = { high: "success", medium: "warning", low: "destructive" } as const;
export function MarksEditor({ rubric, value, onChange, ai, disabled, trial }: { rubric: Rubric; value: ScoreInput; onChange: (v: ScoreInput) => void; ai: Findings; disabled?: boolean; trial?: boolean }) {
  const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-2xl border">
        <table className={`w-full text-sm ${trial ? "" : "min-w-[560px]"}`}>
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2.5">#</th><th className="px-2 py-2.5">Point and evidence</th>{!trial && <><th className="px-2 py-2.5">AI</th><th className="px-2 py-2.5">Confidence</th></>}<th className="px-3 py-2.5">{trial ? "Marks given" : "Your mark"}</th></tr>
          </thead>
          <tbody>
            {rubric.points.map((p, i) => {
              const ev = ai.evidence[p.id]; const aiM = ai.pointMarks[p.id] ?? 0; const mine = value.pointMarks[p.id] ?? 0; const changed = aiM !== mine;
              const low = ev?.confidence === "low" || (p.kind === "deal_breaker" && aiM === 0);
              return (
                <tr key={p.id} className={`border-t ${low ? "bg-red-50/60" : changed ? "bg-amber-50/70" : ""}`}>
                  <td className="px-3 py-3 align-top text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-3 align-top leading-snug">
                    <div className="font-semibold">{p.text} {p.kind === "deal_breaker" && <Tooltip><TooltipTrigger asChild><Badge variant="destructive" className="ml-1 cursor-help align-middle">Deal-breaker</Badge></TooltipTrigger><TooltipContent>If this point scores 0, the whole question is capped at {fmt(rubric.caps.dealBreakerMissing)}.</TooltipContent></Tooltip>}</div>
                    {!trial && <div className="mt-1 text-muted-foreground">{ev?.quote ? `“${ev.quote}”` : "No matching text found."}</div>}
                    {trial && <div className="mt-1 text-muted-foreground">Out of {fmt(p.marks)}</div>}
                  </td>
                  {!trial && <><td className="px-2 py-3 align-top font-semibold">{fmt(aiM)} <span className="font-normal text-muted-foreground">/ {fmt(p.marks)}</span></td>
                  <td className="px-2 py-3 align-top">{ev ? <Tooltip><TooltipTrigger asChild><Badge variant={confVariant[ev.confidence]} className="cursor-help">{ev.confidence}</Badge></TooltipTrigger><TooltipContent>How sure the AI is that it read and matched this point correctly. Low means check it yourself.</TooltipContent></Tooltip> : <Badge variant="muted">new</Badge>}</td></>}
                  <td className="px-3 py-2 align-top">
                    <Input aria-label={`Your mark for point ${i + 1}`} className={`w-24 text-center font-semibold ${changed ? "border-warning" : ""}`} type="number" min={0} max={p.marks} step={0.25} disabled={disabled} value={mine}
                      onChange={(e) => onChange({ ...value, pointMarks: { ...value.pointMarks, [p.id]: Math.max(0, Math.min(p.marks, parseFloat(e.target.value) || 0)) } })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rubric.diagram.required && (
        <fieldset className="space-y-2 rounded-2xl border p-4" disabled={disabled}>
          <legend className="px-1 text-sm font-semibold">Diagram</legend>
          <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={value.diagram.present} onCheckedChange={(v) => onChange({ ...value, diagram: { present: v === true, elementsFound: v === true ? value.diagram.elementsFound : [] } })} />A diagram is present</label>
          {ai.diagramNote && <p className="text-sm text-muted-foreground">AI: {ai.diagramNote}</p>}
          <div className="grid gap-1 sm:grid-cols-2">
            {rubric.diagram.elements.map((el) => (
              <label key={el} className="flex min-h-[36px] items-center gap-2 text-sm"><Checkbox disabled={!value.diagram.present} checked={value.diagram.elementsFound.includes(el)} onCheckedChange={() => onChange({ ...value, diagram: { ...value.diagram, elementsFound: toggle(value.diagram.elementsFound, el) } })} />{el}</label>
            ))}
          </div>
        </fieldset>
      )}
      {rubric.terminology.terms.length > 0 && (
        <fieldset className="space-y-2 rounded-2xl border p-4" disabled={disabled}>
          <legend className="px-1 text-sm font-semibold">Terms used correctly</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {rubric.terminology.terms.map((t) => (
              <label key={t} className="flex min-h-[36px] items-center gap-2 text-sm"><Checkbox checked={value.termsFound.includes(t)} onCheckedChange={() => onChange({ ...value, termsFound: toggle(value.termsFound, t) })} />{t}</label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="flex items-start gap-2 rounded-2xl border p-4 text-sm"><Checkbox className="mt-0.5" disabled={disabled} checked={value.criticalError} onCheckedChange={(v) => onChange({ ...value, criticalError: v === true })} />
        <span><b>The answer states a critical error</b> (for example a wrong valve state). The question is capped at {fmt(rubric.caps.criticalError)}.</span></label>
    </div>
  );
}
