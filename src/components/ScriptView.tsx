import { Badge } from "@/components/ui/badge";
import type { Findings, Question, Rubric } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fmt } from "@/lib/rubric";
import { useEffect, useState } from "react";
import { fetchThumbs, loadThumbs } from "@/lib/api";

/** The original scanned pages, so a reader can compare them with the rewritten text. */
export function ScanThumbs({ scriptId }: { scriptId: string }) {
  const [thumbs, setThumbs] = useState<string[]>(() => loadThumbs(scriptId));
  useEffect(() => { let on = true; fetchThumbs(scriptId).then((t) => { if (on) setThumbs(t); }); return () => { on = false; }; }, [scriptId]);
  if (!thumbs.length) return null;
  return (<div className="space-y-2"><div className="text-sm font-medium">Original scan</div><div className="flex gap-2 overflow-x-auto pb-1">{thumbs.map((t, i) => <a key={i} href={t} target="_blank" rel="noreferrer" className="shrink-0"><img src={t} alt={`Scanned page ${i + 1}`} className="h-40 rounded-xl border object-cover" /></a>)}</div></div>);
}

/** The question as set by the evaluator, shown above every answer that is being read or marked. */
export function QuestionCard({ q }: { q: Pick<Question, "label" | "text" | "marks" | "type"> }) {
  return (<div className="rounded-2xl border-l-4 border-l-primary bg-muted p-4"><div className="mb-1 flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">{q.label}</span><Badge variant="muted">{q.marks} marks</Badge><span className="text-muted-foreground">{q.type}</span></div><p className="text-base">{q.text}</p></div>);
}

/** One scanned page cut down to the strip that holds this answer. Click to open the whole page. */
type Mark = { y0: number; y1: number; label: string; state: "full" | "part" | "none"; reason?: string };
const MARK_STYLE = { full: ["rgba(22,163,74,0.18)", "#16a34a"], part: ["rgba(217,119,6,0.20)", "#d97706"], none: ["rgba(220,38,38,0.16)", "#dc2626"] } as const;
function Crop({ src, page, y0, y1, marks = [] }: { src: string; page: number; y0: number; y1: number; marks?: Mark[] }) {
  const [ratio, setRatio] = useState(0); const [big, setBig] = useState(false);
  const a = Math.max(0, y0 - 0.03), b = Math.min(1, y1 + 0.03), span = Math.max(0.08, b - a);
  return (<>
    <img src={src} alt="" className="hidden" onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
    <button type="button" onClick={() => setBig(true)} aria-label={`Open scanned page ${page}`} className="block w-full overflow-hidden rounded-2xl border bg-white text-left">
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: ratio ? String(ratio / span) : "4 / 1" }}>
        {ratio > 0 && <img src={src} alt={`Scanned page ${page}, the part holding this answer`} className="absolute left-0 w-full max-w-none" style={{ top: `${(-a / span) * 100}%` }} />}
        {ratio > 0 && marks.map((m, i) => { const [bg, fg] = MARK_STYLE[m.state]; const top = ((m.y0 - a) / span) * 100, h = Math.max(((m.y1 - m.y0) / span) * 100, 3);
          return (<div key={i} title={m.reason} data-testid="scan-mark" className="pointer-events-none absolute left-0 right-0" style={{ top: `${top}%`, height: `${h}%`, background: bg, borderTop: `2px solid ${fg}`, borderBottom: `2px solid ${fg}` }}>
            <span className="absolute right-1 top-0 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs font-bold text-white shadow" style={{ background: fg }}>{m.label}</span></div>); })}
      </div>
      <div className="flex items-center justify-between bg-muted px-3 py-1.5 text-xs text-muted-foreground"><span>Page {page}</span><span>Open full page</span></div>
    </button>
    <Dialog open={big} onOpenChange={setBig}><DialogContent className="max-h-[90vh] max-w-3xl overflow-auto"><DialogTitle>Scanned page {page}</DialogTitle><DialogDescription className="sr-only">The whole scanned page</DialogDescription><img src={src} alt={`Scanned page ${page}`} className="w-full rounded-xl" /></DialogContent></Dialog>
  </>);
}

/** The part of the original scan that holds this answer, so the rewritten text can be checked against it. */
export function AnswerScan({ scriptId, f, rubric, marked }: { scriptId: string; f: Findings; rubric?: Rubric; marked?: Record<string, number> }) {
  const [thumbs, setThumbs] = useState<string[]>(() => loadThumbs(scriptId));
  useEffect(() => { let on = true; fetchThumbs(scriptId).then((t) => { if (on) setThumbs(t); }); return () => { on = false; }; }, [scriptId]);
  if (!thumbs.length) return null;
  const byPage = new Map<number, { y0: number; y1: number }>();
  for (const l of f.transcript) {
    if (!l.page || l.page > thumbs.length) continue;
    const cur = byPage.get(l.page); const y0 = l.y0 ?? 0, y1 = l.y1 ?? 1;
    byPage.set(l.page, cur ? { y0: Math.min(cur.y0, y0), y1: Math.max(cur.y1, y1) } : { y0, y1 });
  }
  if (byPage.size === 0) return <ScanThumbs scriptId={scriptId} />;
  const given = marked ?? f.pointMarks;
  const pts = new Map((rubric?.points ?? []).map((p) => [p.id, p]));
  const marksOn = (page: number): Mark[] => f.transcript.flatMap((l) => {
    const p = l.pointId ? pts.get(l.pointId) : undefined;
    if (!p || l.page !== page || l.y0 == null || l.y1 == null) return [];
    const got = given[p.id] ?? 0;
    return [{ y0: l.y0, y1: l.y1, label: got >= p.marks ? `+${fmt(got)}` : got > 0 ? `${fmt(got)}/${fmt(p.marks)}` : `0/${fmt(p.marks)}`, state: got >= p.marks ? "full" as const : got > 0 ? "part" as const : "none" as const, reason: f.evidence[p.id]?.reason || p.text }];
  });
  const shown = new Set(f.transcript.map((l) => l.pointId).filter(Boolean));
  const notFound = (rubric?.points ?? []).filter((p) => !shown.has(p.id) && (given[p.id] ?? 0) < p.marks);
  return (<div className="space-y-2"><div className="text-sm font-medium">Original scan of this answer{rubric && <span className="ml-2 font-normal text-muted-foreground">Marks are shown on the lines that earned them.</span>}</div>
    <div className="space-y-2">{[...byPage.entries()].sort((x, y) => x[0] - y[0]).map(([p, r]) => <Crop key={p} src={thumbs[p - 1]} page={p} y0={r.y0} y1={r.y1} marks={rubric ? marksOn(p) : []} />)}</div>
    {rubric && notFound.length > 0 && <div className="flex flex-wrap gap-1.5 text-xs"><span className="text-muted-foreground">Not found in the writing:</span>{notFound.map((p) => <span key={p.id} className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{p.text} ({fmt(given[p.id] ?? 0)}/{fmt(p.marks)})</span>)}</div>}</div>);
}

export function ScriptView({ f, rubric, onLine, noted, showMarks, demo = true }: { f: Findings; rubric: Rubric; onLine?: (idx: number, pointId?: string) => void; noted?: Set<number>; showMarks?: boolean; demo?: boolean }) {
  const pts = new Map(rubric.points.map((p, i) => [p.id, { p, n: i + 1 }]));
  return (
    <div className="space-y-3">
      <div className={`space-y-1.5 rounded-2xl border bg-[#FBF9F2] p-6 text-[#1B2A6B] ${demo ? "font-['Caveat'] text-[26px] leading-[1.5]" : "text-base leading-relaxed"}`}>
        {f.transcript.map((l, i) => {
          const info = l.pointId ? pts.get(l.pointId) : undefined;
          const full = info ? (f.pointMarks[info.p.id] ?? 0) >= info.p.marks : true;
          const cls = info ? (full ? "bg-green-200/80" : "bg-amber-200/90") : "";
          const Tag = onLine ? "button" : "div";
          return (
            <div key={i} className="flex items-start justify-between gap-3">
              <Tag type={onLine ? "button" : undefined} onClick={onLine ? () => onLine(i, l.pointId) : undefined}
                className={`rounded px-1 text-left ${cls} ${onLine ? "cursor-pointer hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""} ${noted?.has(i) ? "ring-2 ring-primary" : ""}`}>
                {info && <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/80 px-1.5 align-middle font-sans text-[13px] font-semibold text-white">{info.n}</span>}{l.text}
              </Tag>
              {showMarks && info && <span className="shrink-0 pt-1 font-sans text-sm font-semibold text-foreground">{fmt(f.pointMarks[info.p.id] ?? 0)} / {fmt(info.p.marks)}</span>}
            </div>
          );
        })}
        {f.transcript.length === 0 && <div className="font-sans text-sm text-muted-foreground">No readable text found for this answer.</div>}
        {rubric.diagram.required && (
          <div className="mt-3 flex items-start gap-4 rounded-xl border-2 border-dashed border-indigo-300 p-3 font-sans text-sm text-foreground">
            {f.diagram.present ? (<>
              <svg width="120" height="64" viewBox="0 0 150 80" aria-hidden="true" className="shrink-0"><path d="M5 60 C30 60 35 15 60 15 C85 15 90 60 120 60 L145 60" fill="none" stroke="#1B2A6B" strokeWidth="2.5" /><path d="M5 70 L145 70 M5 5 L5 70" stroke="#1B2A6B" strokeWidth="2" /></svg>
              <div><b>Diagram found.</b> {f.diagram.elementsFound.length} of {rubric.diagram.elements.length} required elements.{f.diagramNote && <div className="text-muted-foreground">{f.diagramNote}</div>}</div></>) : <div><b>No diagram found</b> on the pages for this question.</div>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-green-200" />Full marks for this point</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-amber-200" />Partial</span>
        {demo ? <Badge variant="muted">Demo transcript, not a real OCR result</Badge> : <Badge variant="info">Rewritten from the scan by AI</Badge>}
      </div>
    </div>
  );
}
