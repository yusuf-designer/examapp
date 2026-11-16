import { Check, X, Minus } from "lucide-react";
import { fmt } from "@/lib/rubric";
import type { Breakdown, Evidence, Rubric, ScoreInput } from "@/lib/types";

/** One compact table: every thing that carries marks, what was given, and why anything was lost. No scrolling needed for a normal answer. */
export function MarkSheet({ rubric, input, evidence, b }: { rubric: Rubric; input: ScoreInput; evidence?: Record<string, Evidence>; b: Breakdown }) {
  type Row = { key: string; text: string; got: number; max: number; why?: string; tag?: string };
  const rows: Row[] = rubric.points.map((p, i) => {
    const got = input.pointMarks[p.id] ?? 0;
    return { key: p.id, text: `${i + 1}. ${p.text}`, got, max: p.marks, tag: p.kind === "deal_breaker" ? "Key point" : undefined,
      why: got >= p.marks ? undefined : evidence?.[p.id]?.reason || (got === 0 ? "Not found in the answer." : "Only partly covered.") };
  });
  if (rubric.diagram.required) rows.push({ key: "diagram", text: "Diagram", got: b.diagram, max: b.diagramMax, why: b.diagram >= b.diagramMax ? undefined : b.diagramNote || "Diagram missing or incomplete." });
  if (rubric.terminology.terms.length) rows.push({ key: "terms", text: "Technical terms", got: b.terminology, max: b.terminologyMax, why: b.missedTerms.length ? `Missing: ${b.missedTerms.join(", ")}` : undefined });
  return (
    <div className="overflow-hidden rounded-2xl border bg-card" data-testid="mark-sheet">
      <ul className="divide-y">
        {rows.map((r) => {
          const state = r.got >= r.max ? "full" : r.got > 0 ? "part" : "none";
          const Icon = state === "full" ? Check : state === "part" ? Minus : X;
          const tone = state === "full" ? "bg-green-100 text-green-700" : state === "part" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
          return (<li key={r.key} className="flex items-start gap-3 px-3 py-2.5 text-sm">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="h-4 w-4" aria-hidden /></span>
            <div className="min-w-0 flex-1"><div className="leading-snug">{r.text}{r.tag && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{r.tag}</span>}</div>
              {r.why && <div className="mt-0.5 text-xs text-red-700">{r.why}</div>}</div>
            <div className="shrink-0 font-semibold tabular-nums">{fmt(r.got)}<span className="font-normal text-muted-foreground"> / {fmt(r.max)}</span></div>
          </li>);
        })}
        {b.criticalError && <li className="px-3 py-2.5 text-sm text-red-700">A serious error in the answer was found, so the mark is limited.</li>}
        {b.cap !== null && b.raw > b.total && <li className="flex justify-between px-3 py-2.5 text-sm text-red-700"><span>{b.capReason || "Mark limited"}</span><span className="font-semibold">−{fmt(b.raw - b.total)}</span></li>}
      </ul>
      <div className="flex items-baseline justify-between bg-muted px-3 py-2.5"><span className="font-semibold">Total</span><span className="font-display text-xl font-bold tabular-nums">{fmt(b.total)}<span className="text-sm font-medium text-muted-foreground"> / {fmt(b.max)}</span></span></div>
    </div>
  );
}
