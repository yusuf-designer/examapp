import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/simple-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, PageHeader, Stat, useNav, WindowPill } from "@/components/shared";
import { fmt } from "@/lib/rubric";
import { actions, flagsFor, runAction, useApp, useMe, windowStatus } from "@/lib/store";
import { aiTotal } from "@/lib/selectors";

export default function ReviewList() {
  const s = useApp(); const me = useMe(); const { go } = useNav();
  const [filter, setFilter] = useState<"all" | "pending" | "flagged" | "done">("pending");
  const [query, setQuery] = useState(""); const [qf, setQf] = useState("all"); const [kind, setKind] = useState("all"); const [sort, setSort] = useState("newest"); const [page, setPage] = useState(0);
  const mineAll = s.evaluations.filter((e) => e.examinerId === me.id);
  const examOfEval = (sid: string) => s.scripts.find((x) => x.id === sid)?.examId;
  const myExamIds = [...new Set(mineAll.map((e) => examOfEval(e.scriptId)).filter(Boolean))] as string[];
  const [examId, setExamId] = useState("");
  const exam = s.exams.find((e) => e.id === (examId || myExamIds[0])) ?? s.exams[0];
  const mine = mineAll.filter((e) => examOfEval(e.scriptId) === exam.id);
  const order = new Map(s.scripts.map((x, i) => [x.id, i]));
  const rows = mine.map((e, n) => { const sc = s.scripts.find((x) => x.id === e.scriptId)!; const q = exam.questions.find((x) => x.id === e.qid)!; return { e, sc, q, n, at: (order.get(sc.id) ?? 0) * 1000 + n % 1000, flags: flagsFor(e, sc.findings[e.qid], q.rubric, q.marks) }; });
  const KIND: Record<string, RegExp> = { confidence: /confidence/, deal: /deal-breaker|critical/, injection: /instruction aimed/i, disagree: /disagree/, scheme: /new in this scheme|scheme/i };
  const shown = useMemo(() => {
    const t = query.trim().toLowerCase();
    const list = rows.filter((r) =>
      (filter === "all" || (filter === "pending" ? r.e.status === "pending" : filter === "done" ? r.e.status === "finalised" : r.e.status === "pending" && r.flags.length > 0)) &&
      (qf === "all" || r.q.id === qf) && (kind === "all" || r.flags.some((x) => KIND[kind].test(x))) &&
      (!t || r.sc.id.toLowerCase().includes(t) || r.q.label.toLowerCase().includes(t)));
    const by: Record<string, (x: typeof rows[number], y: typeof rows[number]) => number> = {
      newest: (x, y) => y.at - x.at, oldest: (x, y) => x.at - y.at, script: (x, y) => x.sc.id.localeCompare(y.sc.id, undefined, { numeric: true }),
      flags: (x, y) => y.flags.length - x.flags.length || y.at - x.at, low: (x, y) => aiTotal(s, x.e) - aiTotal(s, y.e) || y.at - x.at, high: (x, y) => aiTotal(s, y.e) - aiTotal(s, x.e) || y.at - x.at };
    return [...list].sort(by[sort]);
  }, [rows, filter, query, qf, kind, sort, s]);
  const PER = 15; const pages = Math.max(1, Math.ceil(shown.length / PER));
  useEffect(() => { setPage(0); }, [filter, query, qf, kind, sort]);
  const view = shown.slice(page * PER, page * PER + PER);
  const counts = { pending: rows.filter((r) => r.e.status === "pending").length, flagged: rows.filter((r) => r.e.status === "pending" && r.flags.length).length, done: rows.filter((r) => r.e.status === "finalised").length };
  const filtering = query || qf !== "all" || kind !== "all";
  const pend = rows.filter((r) => r.e.status === "pending"), clean = pend.filter((r) => !r.flags.length);
  const open = windowStatus(exam, "evaluation").open;
  return (
    <>
      <PageHeader crumb="Evaluator" title="My marking" sub="The AI proposes a mark for each answer, with quotes as evidence. You decide. Any change needs a written reason." actions={<div className="min-w-[14rem]"><WindowPill exam={exam} name="evaluation" /></div>} />
      {mine.length === 0 ? <Empty>Nothing is assigned to you yet. The admin assigns scripts after the scheme is locked and scans are uploaded.</Empty> : (<>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat value={mine.length} label="Answers assigned" />
          <Stat tone="good" value={mine.length - pend.length} label="Finalised" />
          <Stat tone={pend.some((r) => r.flags.length) ? "warn" : "good"} value={pend.filter((r) => r.flags.length).length} label="Need a closer look" hint="Low confidence, deal-breaker, injection, disagreement" />
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)} aria-label="Filter answers"><ToggleGroupItem value="pending">To do · {counts.pending}</ToggleGroupItem><ToggleGroupItem value="flagged">Flagged · {counts.flagged}</ToggleGroupItem><ToggleGroupItem value="done">Done · {counts.done}</ToggleGroupItem><ToggleGroupItem value="all">All · {rows.length}</ToggleGroupItem></ToggleGroup>
          <Button variant="secondary" disabled={!open || clean.length === 0} onClick={() => runAction(() => actions.finaliseAllClean(exam.id), (n) => `${n} answers without flags accepted.`)}>Accept {clean.length} answers without flags</Button>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search scripts" className="pl-10" placeholder="Search script or question" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          {myExamIds.length > 1 && <SimpleSelect label="Exam" className="w-56" value={exam.id} onValueChange={(v) => { setExamId(v); setQf("all"); }} options={myExamIds.map((id) => { const e = s.exams.find((x) => x.id === id)!; return { value: id, label: `${e.subject} ${e.paper}` }; })} />}
          <SimpleSelect label="Question" className="w-44" value={qf} onValueChange={setQf} options={[{ value: "all", label: "All questions" }, ...exam.questions.map((q) => ({ value: q.id, label: q.label }))]} />
          <SimpleSelect label="Flag type" className="w-52" value={kind} onValueChange={setKind} options={[{ value: "all", label: "Any flag" }, { value: "confidence", label: "Low AI confidence" }, { value: "deal", label: "Deal-breaker or critical error" }, { value: "disagree", label: "Second pass disagrees" }, { value: "injection", label: "Instruction in the answer" }, { value: "scheme", label: "Scheme changed" }]} />
          <SimpleSelect label="Sort by" className="w-48" value={sort} onValueChange={setSort} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "script", label: "Script number" }, { value: "flags", label: "Most flags first" }, { value: "low", label: "Lowest AI total first" }, { value: "high", label: "Highest AI total first" }]} />
          {filtering && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setQf("all"); setKind("all"); }}><X className="h-4 w-4" />Clear</Button>}
        </div>
        <Card><CardContent className="px-0 py-2">
          <Table>
            <TableHeader><TableRow><TableHead>Script</TableHead><TableHead>Question</TableHead><TableHead className="whitespace-nowrap">AI total</TableHead><TableHead>Flags</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{view.map(({ e, sc, q, flags }) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap font-semibold">{sc.id}</TableCell><TableCell className="whitespace-nowrap">{q.label}</TableCell><TableCell className="whitespace-nowrap">{fmt(aiTotal(s, e))} / {q.marks}</TableCell>
                <TableCell className="max-w-sm">{flags.length ? <ul className="space-y-1 text-sm text-destructive">{flags.map((f) => <li key={f}>{f}</li>)}</ul> : <span className="text-muted-foreground">None</span>}</TableCell>
                <TableCell>{e.status === "finalised" ? <Badge variant="success">Final {fmt(e.finalTotal ?? 0)}</Badge> : <Badge variant="warning">Pending</Badge>}</TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => go("review", { scriptId: sc.id, qid: q.id })}>{e.status === "finalised" ? "View" : "Review"}</Button></TableCell>
              </TableRow>))}</TableBody>
          </Table>
          {shown.length === 0 && <div className="p-8 text-center text-muted-foreground">{filtering ? "No answers match these filters." : "Nothing here."}</div>}
          {shown.length > PER && <div className="flex items-center justify-between gap-3 border-t border-border px-6 pt-3 text-sm text-muted-foreground"><span>{page * PER + 1}–{Math.min(shown.length, page * PER + PER)} of {shown.length}</span><div className="flex items-center gap-1"><Button size="sm" variant="outline" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button><span className="px-2">Page {page + 1} of {pages}</span><Button size="sm" variant="outline" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>}
        </CardContent></Card>
        <p className="mt-3 text-sm text-muted-foreground">Bulk accept only covers answers with no flags. Flagged answers always need your eyes.</p>
      </>)}
    </>
  );
}
