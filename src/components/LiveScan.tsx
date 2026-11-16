import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { computeScore, fmt } from "@/lib/rubric";
import type { ScanEvent } from "../../server/ai";
import type { Findings, Question } from "@/lib/types";

type Line = { page: number; text: string; y0?: number; y1?: number; question?: string | null; kind?: string };
export interface LiveState {
  startedAt: number; totalPages: number; pagesRead: number; sorted: boolean; failed?: string;
  lines: Line[]; q: Record<string, { status: "waiting" | "grading" | "done" | "failed"; seconds?: number; findings?: Findings }>;
  focus: string | null; stamps: { label: string; at: number }[];
}
export const liveStart = (questions: Question[]): LiveState => ({ startedAt: Date.now(), totalPages: 0, pagesRead: 0, sorted: false, lines: [], focus: null, stamps: [],
  q: Object.fromEntries(questions.map((x) => [x.id, { status: "waiting" as const }])) });

/** Folds one progress event from the server into what the screen shows. */
export function liveReduce(s: LiveState, e: ScanEvent): LiveState {
  const at = Date.now() - s.startedAt;
  switch (e.type) {
    case "start": return { ...s, totalPages: e.pages };
    case "page": return { ...s, pagesRead: s.pagesRead + 1, lines: [...s.lines, ...e.lines.map((l) => ({ ...l, page: e.page }))], stamps: s.pagesRead + 1 >= s.totalPages ? [...s.stamps, { label: "Pages read", at }] : s.stamps };
    case "sorted": return { ...s, sorted: true, lines: e.lines, stamps: [...s.stamps, { label: "Lines sorted into questions", at }] };
    case "grading": return { ...s, focus: e.qid, q: { ...s.q, [e.qid]: { ...s.q[e.qid], status: "grading" } } };
    case "graded": return { ...s, focus: e.qid, q: { ...s.q, [e.qid]: { status: "done", seconds: e.seconds, findings: e.findings } } };
    case "failed": return { ...s, q: { ...s.q, [e.qid]: { status: "failed" } } };
  }
}

const matches = (label: string | null | undefined, q: Question) => !!label && label.replace(/[^a-z0-9]/gi, "").toLowerCase() === q.label.replace(/[^a-z0-9]/gi, "").toLowerCase();

/** Shows the pages while they are read and graded: lines light up, the page scrolls to the question being graded, marks appear on the evidence. */
export function LiveScan({ state, images, questions, running }: { state: LiveState; images: string[]; questions: Question[]; running: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [running]);
  const box = useRef<HTMLDivElement>(null);
  const secs = ((running ? now : state.stamps.at(-1) ? state.startedAt + state.stamps.at(-1)!.at : now) - state.startedAt) / 1000;

  // Place each line on its page. When the OCR gave no position, spread the page's lines evenly.
  const placed = useMemo(() => {
    const byPage = new Map<number, Line[]>(); state.lines.forEach((l) => byPage.set(l.page, [...(byPage.get(l.page) ?? []), l]));
    return state.lines.map((l, i) => {
      if (l.y0 !== undefined && l.y1 !== undefined) return { ...l, i, top: l.y0, h: Math.max(0.012, l.y1 - l.y0) };
      const sib = byPage.get(l.page)!; const k = sib.indexOf(l); const n = sib.length; return { ...l, i, top: 0.06 + (k / n) * 0.88, h: 0.88 / n * 0.8 };
    });
  }, [state.lines]);

  // The question being graded: lines to highlight, and the mark each evidence line earned.
  const evidence = useMemo(() => {
    const m = new Map<string, { marks: number; max: number }>();
    for (const q of questions) { const f = state.q[q.id]?.findings; if (!f) continue;
      for (const t of f.transcript) if (t.pointId) { const p = q.rubric.points.find((x) => x.id === t.pointId); if (p) m.set(`${t.page}|${t.text}`, { marks: f.pointMarks[p.id] ?? 0, max: p.marks }); } }
    return m;
  }, [state.q, questions]);
  const focusQ = questions.find((x) => x.id === state.focus);
  const firstOf = (q: Question) => placed.find((l) => matches(l.question, q));
  const focusLine = focusQ ? firstOf(focusQ) : undefined;
  useEffect(() => { if (focusLine) document.getElementById(`live-line-${focusLine.i}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" }); }, [state.focus, focusLine?.i, state.sorted]); // eslint-disable-line

  const step = (done: boolean, text: string, extra?: string) => (
    <li className="flex items-center gap-2 text-sm">{done ? <Check className="h-4 w-4 text-emerald-600" /> : running ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-4 w-4" />}<span className={done ? "" : "text-muted-foreground"}>{text}</span>{extra && <span className="ml-auto text-xs text-muted-foreground">{extra}</span>}</li>);
  const at = (label: string) => { const x = state.stamps.find((t) => t.label === label); return x ? `${(x.at / 1000).toFixed(0)}s` : undefined; };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4" data-testid="live-scan">
      <div className="space-y-4">
        <div className="flex items-baseline justify-between"><span className="text-sm font-semibold">{running ? "Working on it…" : "Finished"}</span><span className="tabular-nums text-sm text-muted-foreground">{secs.toFixed(0)}s</span></div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {step(state.totalPages > 0 && state.pagesRead >= state.totalPages, `Reading pages ${state.pagesRead}/${state.totalPages || "…"}`, at("Pages read"))}
          {step(state.sorted, "Sorting lines into questions", at("Lines sorted into questions"))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{questions.map((q) => {
          const st = state.q[q.id]; const total = st?.findings ? computeScore(q.rubric, st.findings, q.marks).total : undefined;
          return (<button type="button" key={q.id} onClick={() => { const l = firstOf(q); if (l) document.getElementById(`live-line-${l.i}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" }); }}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${st?.status === "grading" ? "border-amber-400 bg-amber-50" : ""}`}>
            {st?.status === "done" ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : st?.status === "failed" ? <TriangleAlert className="h-4 w-4 shrink-0 text-red-600" /> : st?.status === "grading" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <span className="h-4 w-4 shrink-0 rounded-full border" />}
            <span className="flex-1">{q.label}</span>
            <span className="tabular-nums text-xs text-muted-foreground">{st?.status === "done" ? `${fmt(total!)} / ${q.marks} · ${st.seconds?.toFixed(0)}s` : st?.status === "failed" ? "by hand" : st?.status === "grading" ? "grading…" : "waiting"}</span>
          </button>);
        })}</div>
      </div>
      <div ref={box} className="max-h-[75vh] min-h-[16rem] space-y-3 overflow-y-auto rounded-xl bg-muted p-2">
        {images.length === 0 && <div className="space-y-1 p-3 text-sm">{state.lines.map((l, i) => <p key={i}>{l.text}</p>)}{!state.lines.length && <p className="text-muted-foreground">Waiting for the first lines…</p>}</div>}
        {images.map((src, pi) => (
          <div key={pi} className="relative overflow-hidden rounded-lg bg-white shadow-sm">
            <img src={src} alt={`Page ${pi + 1}`} className="block w-full" />
            {placed.filter((l) => l.page === pi + 1).map((l) => {
              const q = questions.find((x) => matches(l.question, x)); const st = q ? state.q[q.id]?.status : undefined; const ev = evidence.get(`${l.page}|${l.text}`);
              const tone = ev ? (ev.marks >= ev.max ? "border-emerald-500 bg-emerald-400/25" : ev.marks > 0 ? "border-amber-500 bg-amber-400/30" : "border-red-500 bg-red-400/25")
                : st === "grading" ? "border-amber-400 bg-amber-300/30 animate-pulse" : !state.sorted ? "border-sky-400 bg-sky-300/20" : "border-transparent bg-sky-200/10";
              return (<div id={`live-line-${l.i}`} key={l.i} className={`pointer-events-none absolute left-[2%] right-[2%] rounded border ${tone} transition-colors`} style={{ top: `${l.top * 100}%`, height: `${l.h * 100}%` }}>
                {ev && <span className="absolute -top-2 right-0 rounded-full bg-background px-1.5 text-[10px] font-semibold shadow">{ev.marks >= ev.max ? "✓" : ev.marks > 0 ? "½" : "✗"} {fmt(ev.marks)}/{fmt(ev.max)}</span>}
              </div>);
            })}
          </div>))}
      </div>
    </div>
  );
}
