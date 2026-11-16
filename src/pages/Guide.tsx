import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared";
import { computeScore, fmt } from "@/lib/rubric";
import { Q3_RUBRIC } from "@/lib/seed";
import type { ScoreInput } from "@/lib/types";

const r = Q3_RUBRIC;
const full: ScoreInput = { pointMarks: Object.fromEntries(r.points.map((p) => [p.id, p.marks])), diagram: { present: true, elementsFound: r.diagram.elements }, termsFound: r.terminology.terms, criticalError: false };
const EX: [string, string, ScoreInput][] = [
  ["Complete answer", "Every point, full diagram, all terms", full],
  ["Everything right, no diagram", "Diagram marks are lost, nothing else", { ...full, diagram: { present: false, elementsFound: [] } }],
  ["Diagram with only 2 of 5 elements", "Half the diagram marks", { ...full, diagram: { present: true, elementsFound: r.diagram.elements.slice(0, 2) } }],
  ["Everything right except two terms missing", "Each missed term costs 0.25", { ...full, termsFound: r.terminology.terms.slice(2) }],
  ["Isovolumetric contraction missing, rest perfect", "A deal-breaker scored 0 caps the question at 5", { ...full, pointMarks: { ...full.pointMarks, q3p2: 0 } }],
  ["States a wrong valve state, rest perfect", "A critical error caps the question at 3", { ...full, criticalError: true }],
];
export default function Guide() {
  return (
    <>
      <PageHeader title="How marking works here" sub="A rubric is a marking guide written before the exam. It fixes what earns marks and what costs them, so every student is judged by the same rules." />
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {[["Checklist", "One mark per point, present or absent. Fast, but cannot separate a half-right point from a fully right one."], ["Analytic (used here)", "Each criterion has a weight and levels. Best fit for MBBS essays because it is transparent and repeatable."], ["Holistic", "One overall impression gives one mark. Quick, but the least consistent. Avoid for high-stakes exams."]].map(([t, d], i) => (
          <Card key={t} className={i === 1 ? "border-2 border-primary" : ""}><CardHeader><CardTitle>{t}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{d}</CardContent></Card>))}
      </div>
      <Card className="mb-8"><CardHeader><CardTitle>The four parts of the rubric</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm md:grid-cols-2">
        <div><Badge variant="info">Content points</Badge><p className="mt-2 text-muted-foreground">Model-answer points with fixed marks. The AI quotes the student’s words as evidence and proposes a mark in steps of 0.25.</p></div>
        <div><Badge variant="destructive">Deal-breakers</Badge><p className="mt-2 text-muted-foreground">Points a correct answer cannot omit. If one scores 0 the whole question is capped. A stated critical error has a lower cap.</p></div>
        <div><Badge variant="success">Diagram</Badge><p className="mt-2 text-muted-foreground">Reserved marks. No diagram loses all, too few required elements loses half, enough loses nothing.</p></div>
        <div><Badge variant="warning">Terminology</Badge><p className="mt-2 text-muted-foreground">A list of required terms. Each one missed costs a fixed amount, up to the marks reserved for terminology.</p></div>
      </CardContent></Card>
      <Card className="mb-8">
        <CardHeader><CardTitle>Worked example · Cardiac cycle, 10 marks</CardTitle><CardDescription>These totals are computed live by the same engine that grades scripts. Content 7.5 + diagram 1.5 + terminology 1.0, with caps at 5 and 3.</CardDescription></CardHeader>
        <CardContent className="px-0"><Table>
          <TableHeader><TableRow><TableHead>Answer</TableHead><TableHead>Rule that applies</TableHead><TableHead>Content</TableHead><TableHead>Diagram</TableHead><TableHead>Terms</TableHead><TableHead>Cap</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
          <TableBody>{EX.map(([n, why, inp]) => { const b = computeScore(r, inp, 10); return (
            <TableRow key={n}><TableCell className="font-semibold">{n}</TableCell><TableCell className="text-muted-foreground">{why}</TableCell><TableCell>{fmt(b.content)}</TableCell><TableCell>{fmt(b.diagram)}</TableCell><TableCell>{fmt(b.terminology)}</TableCell><TableCell>{b.cap === null ? "—" : fmt(b.cap)}</TableCell><TableCell className="font-bold">{fmt(b.total)}</TableCell></TableRow>); })}</TableBody>
        </Table></CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Why this is fairer than a model answer alone</CardTitle></CardHeader><CardContent>
        <Accordion type="single" collapsible defaultValue="ai">
          <AccordionItem value="ai"><AccordionTrigger>The AI never decides a mark</AccordionTrigger><AccordionContent className="text-muted-foreground">It reports what is present, with quotes. The locked rubric turns that into marks, so the same script always gets the same marks.</AccordionContent></AccordionItem>
          <AccordionItem value="humans"><AccordionTrigger>Humans own every decision</AccordionTrigger><AccordionContent className="text-muted-foreground">The examiner can change any mark, but must write a reason. Reasons, old marks and new marks go into a hash-chained audit trail.</AccordionContent></AccordionItem>
          <AccordionItem value="drift"><AccordionTrigger>The rules cannot drift</AccordionTrigger><AccordionContent className="text-muted-foreground">Once locked, the scheme changes only through a written request approved by the Dean or Principal, as a new version, with affected answers re-opened for everyone.</AccordionContent></AccordionItem>
          <AccordionItem value="limits" className="border-b-0"><AccordionTrigger>Limits to know</AccordionTrigger><AccordionContent className="text-muted-foreground">This demo uses simulated AI findings, not real handwriting recognition. Before using real marks, validate the AI against your examiners on your own scripts and run it in shadow mode first.</AccordionContent></AccordionItem>
        </Accordion>
      </CardContent></Card>
    </>
  );
}
