import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Empty as EmptyRoot, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Field as FieldRoot, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmt } from "@/lib/rubric";
import type { Breakdown, ScoreInput, Exam, Rubric, WindowName } from "@/lib/types";
import { windowStatus } from "@/lib/store";

export type Route = { page: string; params?: Record<string, string> };
export const NavCtx = createContext<{ route: Route; go: (page: string, params?: Record<string, string>) => void }>({ route: { page: "home" }, go: () => {} });
export const useNav = () => useContext(NavCtx);

export function PageHeader({ title, sub, actions, crumb }: { title: string; sub?: string; actions?: ReactNode; crumb?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

const WIN_LABEL: Record<WindowName, string> = { entry: "Evaluator entry", evaluation: "Evaluation", recheck: "Student recheck" };
export function WindowPill({ exam, name }: { exam: Exam; name: WindowName }) {
  const w = windowStatus(exam, name);
  const v = w.open ? "success" : w.state === "closed" ? "muted" : "warning";
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="font-medium">{WIN_LABEL[name]}</span>
      <Badge variant={v}>{w.open ? `Open · ${w.left}` : w.state === "closed" ? "Closed" : "Not started"}</Badge>
    </div>
  );
}

export function Stat({ value, label, hint, tone = "default", icon: Icon, goto }: { value: ReactNode; label: string; hint?: string; tone?: "default" | "warn" | "bad" | "good"; icon?: LucideIcon; goto?: string }) {
  const tint = { default: "bg-muted text-foreground", warn: "bg-amber-100 text-amber-800", bad: "bg-red-100 text-red-700", good: "bg-green-100 text-green-800" }[tone];
  return (
    <Card className={`group h-full transition-shadow ${goto ? "hover:shadow-md" : ""}`}>
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          {Icon && <span className={`flex h-10 w-10 items-center justify-center rounded-full ${tint}`}><Icon className="h-5 w-5" /></span>}
          {goto && <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground" aria-hidden="true"><ArrowUpRight className="h-4 w-4" /></span>}
        </div>
        <div className="space-y-1">
          <div className="font-display text-4xl font-semibold leading-none tracking-tight">{value}</div>
          <div className="text-sm font-medium">{label}</div>
        </div>
        <div className="mt-auto space-y-1">
          {hint && <div className="text-sm text-muted-foreground">{hint}</div>}
          {goto && <div className="text-xs font-medium text-muted-foreground">Opens {goto}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function BreakdownCard({ rubric, b, title = "How the marks add up" }: { rubric: Rubric; b: Breakdown; title?: string }) {
  const Row = ({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: string }) => (
    <div className={`flex items-start justify-between gap-4 border-b py-2.5 text-sm last:border-0 ${strong ? "text-base font-semibold" : ""}`}>
      <span>{label}</span><span className={`whitespace-nowrap font-semibold ${tone ?? ""}`}>{value}</span>
    </div>
  );
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <Row label="Content points" value={`${fmt(b.content)} / ${fmt(b.contentMax)}`} />
        {rubric.diagram.required && <Row label={<>Diagram <span className="text-muted-foreground">· {b.diagramNote}</span></>} value={`${fmt(b.diagram)} / ${fmt(b.diagramMax)}`} />}
        {rubric.terminology.terms.length > 0 && (
          <Row label={<>Terminology{b.missedTerms.length ? <span className="text-muted-foreground"> · missed {b.missedTerms.map((t) => `“${t}”`).join(", ")}</span> : null}</>} value={`${fmt(b.terminology)} / ${fmt(b.terminologyMax)}`} />
        )}
        <Row label="Subtotal before caps" value={fmt(b.raw)} />
        <Row label="Deal-breaker or error cap" value={b.cap === null ? "Not triggered" : `Capped at ${fmt(b.cap)} · ${b.capReason}`} tone={b.cap === null ? "text-success" : "text-destructive"} />
        <Separator className="my-1" />
        <Row strong label="Total" value={`${fmt(b.total)} / ${fmt(b.max)}`} />
      </CardContent>
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <EmptyRoot><EmptyHeader><EmptyDescription className="text-base">{children}</EmptyDescription></EmptyHeader></EmptyRoot>;
}
export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <FieldRoot>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </FieldRoot>
  );
}
export const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

/** Plain list of every place marks were lost, with the reason. Optionally lets the student defend a lost point. */
export function DeductionList({ rubric, input, evidence, b, claims, onClaim, claimsOpen }: {
  rubric: Rubric; input: ScoreInput; evidence?: Record<string, { reason?: string; quote?: string }>; b: Breakdown;
  claims?: Record<string, string>; onClaim?: (pointId: string, text: string) => void; claimsOpen?: boolean;
}) {
  const lost = rubric.points.map((p, i) => ({ p, n: i + 1, got: input.pointMarks[p.id] ?? 0 })).filter((x) => x.got < x.p.marks);
  const diagramLost = rubric.diagram.required ? b.diagramMax - b.diagram : 0;
  const termsLost = rubric.terminology.terms.length ? b.terminologyMax - b.terminology : 0;
  const capLost = b.cap !== null ? Math.max(0, b.raw - b.total) : 0;
  const none = !lost.length && diagramLost <= 0 && termsLost <= 0 && capLost <= 0;
  const Item = ({ title, lostBy, children }: { title: ReactNode; lostBy: number; children?: ReactNode }) => (
    <li className="space-y-1 rounded-2xl bg-muted/60 p-3 text-sm">
      <div className="flex items-start justify-between gap-3"><span className="font-medium">{title}</span><span className="shrink-0 font-semibold text-destructive">−{fmt(lostBy)}</span></div>{children}
    </li>
  );
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle>Where marks were lost</CardTitle></CardHeader>
      <CardContent>
        {none ? <p className="text-sm text-muted-foreground">No marks were lost on this answer.</p> : (
          <ul className="space-y-2">
            {lost.map(({ p, n, got }) => (
              <Item key={p.id} lostBy={p.marks - got} title={<>Point {n}: {p.text}{p.kind === "deal_breaker" && <Badge variant="destructive" className="ml-2 align-middle">Deal-breaker</Badge>}</>}>
                <p className="text-muted-foreground">{evidence?.[p.id]?.reason || (got === 0 ? "Not found in the answer." : "Only partly covered.")}</p>
                {claimsOpen && onClaim && (
                  <div className="pt-1"><label className="text-xs font-semibold" htmlFor={`claim-${p.id}`}>I did cover this. Here is what I wrote or meant</label>
                    <textarea id={`claim-${p.id}`} className="mt-1 min-h-[64px] w-full rounded-2xl border-0 bg-card px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={claims?.[p.id] ?? ""} onChange={(e) => onClaim(p.id, e.target.value)} placeholder="Write your own answer for this point" /></div>)}
              </Item>))}
            {diagramLost > 0 && <Item lostBy={diagramLost} title="Diagram"><p className="text-muted-foreground">{b.diagramNote}</p></Item>}
            {termsLost > 0 && <Item lostBy={termsLost} title="Terminology"><p className="text-muted-foreground">Not used: {b.missedTerms.map((t) => `“${t}”`).join(", ")}</p></Item>}
            {capLost > 0 && <Item lostBy={capLost} title={`Capped at ${fmt(b.cap!)}`}><p className="text-muted-foreground">{b.capReason}</p></Item>}
          </ul>)}
      </CardContent>
    </Card>
  );
}
