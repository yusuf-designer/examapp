import { FolderInput, GitPullRequest, LockOpen, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Stat, useNav, WindowPill } from "@/components/shared";
import { ROLE_LABEL, ROLE_SCOPE, can } from "@/lib/permissions";
import { useApp, useMe, windowStatus } from "@/lib/store";
import { progress, stage } from "@/lib/selectors";


export default function Dashboard() {
  const s = useApp(); const me = useMe(); const { go } = useNav();
  const live = s.exams.filter((e) => !e.demoOnly);
  const pendingEdits = s.editRequests.filter((r) => r.status === "pending").length;
  const unlocked = live.reduce((n, e) => n + e.questions.filter((q) => !q.locked).length, 0);
  const toAssign = live.filter((e) => stage(s, e).label === "Assign examiners").length;
  const pendingRechecks = s.rechecks.filter((r) => r.status !== "decided").length;
  const closing = live.flatMap((e) => (["entry", "evaluation", "recheck"] as const).map((n) => ({ e, n, w: windowStatus(e, n) }))).filter((x) => x.w.open);
  const visible = me.role === "hod" ? s.exams.filter((e) => e.department === me.department) : s.exams;
  return (
    <>
      <PageHeader crumb="Admin portal" title="Term 1 Examinations"
        actions={can(me, "upload_scans") && <Button onClick={() => go("scripts")}>Scan and assign scripts</Button>} />
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button className="h-full text-left" onClick={() => go("requests")}><Stat tone={pendingEdits ? "warn" : "good"} value={pendingEdits} label="Edit requests waiting" icon={GitPullRequest} goto="Edit requests" hint={pendingEdits ? "Admin decides" : "Nothing pending"} /></button>
        <button className="h-full text-left" onClick={() => go("scripts")}><Stat tone={toAssign ? "bad" : "good"} value={toAssign} label="Exams ready to assign" icon={FolderInput} goto="Scripts" hint="Scanned and scheme locked" /></button>
        <button className="h-full text-left" onClick={() => go("schemes")}><Stat tone={unlocked ? "warn" : "good"} value={unlocked} label="Questions not yet locked" icon={LockOpen} goto="Marking schemes" hint="Draft schemes" /></button>
        <button className="h-full text-left" onClick={() => go("results")}><Stat tone={pendingRechecks ? "warn" : "good"} value={pendingRechecks} label="Rechecks open" icon={Undo2} goto="Results and rechecks" hint="Student requests" /></button>
      </div>
      <Card className="mb-8">
        <CardHeader><CardTitle>Exams by year</CardTitle></CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader><TableRow><TableHead>Year and phase</TableHead><TableHead>Paper</TableHead><TableHead>Scheme</TableHead><TableHead>Scripts</TableHead><TableHead>Marked</TableHead><TableHead>Stage</TableHead></TableRow></TableHeader>
            <TableBody>
              {visible.map((e) => {
                const p = progress(s, e); const st = stage(s, e); const locked = e.questions.filter((q) => q.locked).length;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-semibold">{e.year}</TableCell>
                    <TableCell>{e.subject} {e.paper}</TableCell>
                    <TableCell>{e.demoOnly ? <span className="text-muted-foreground">—</span> : <Badge variant={locked === e.questions.length ? "success" : "warning"}>{locked} of {e.questions.length} locked</Badge>}</TableCell>
                    <TableCell>{e.demoOnly ? "—" : p.scripts}</TableCell>
                    <TableCell className="min-w-[150px]">{p.total ? <div className="flex items-center gap-2"><Progress value={p.pct} className="w-20" /><span className="text-xs text-muted-foreground">{p.pct}%</span></div> : "—"}</TableCell>
                    <TableCell><Badge variant={st.tone}>{st.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="mb-8">
        <Card>
          <CardHeader><CardTitle>Open time windows</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {closing.length === 0 && <p className="text-sm text-muted-foreground">No window is open right now.</p>}
            {closing.map(({ e, n }) => (<div key={e.id + n} className="space-y-1"><div className="text-sm font-semibold">{e.subject} {e.paper}</div><WindowPill exam={e} name={n} /></div>))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
