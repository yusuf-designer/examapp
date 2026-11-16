import { useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, when } from "@/components/shared";
import { ROLE_LABEL } from "@/lib/permissions";
import { verifyChain } from "@/lib/audit";
import { actions, notify, userName, useApp, useMe } from "@/lib/store";

const GROUPS: Record<string, string[]> = { All: [], Scheme: ["scheme.", "edit."], Marks: ["mark.", "scripts.", "scans."], Windows: ["window."], Results: ["results.", "recheck."] };
export default function Audit() {
  const s = useApp(); const me = useMe(); const [g, setG] = useState("All"); const [res, setRes] = useState<null | number | "ok">(null);
  const all = me.role === "student" ? s.audit.filter((e) => me.scriptId && e.target.includes(me.scriptId)) : me.role === "evaluator" ? s.audit.filter((e) => e.actorId === me.id) : s.audit;
  const rows = [...all].reverse().filter((e) => g === "All" || GROUPS[g].some((p) => e.action.startsWith(p)));
  const csv = () => {
    const head = "seq,time,actor,role,action,target,detail,reason,hash\n";
    const body = s.audit.map((e) => [e.seq, e.ts, userName(s, e.actorId), e.actorRole, e.action, e.target, e.detail, e.reason ?? "", e.hash].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const data = head + body;
    try { void navigator.clipboard.writeText(data).then(() => notify("CSV copied to the clipboard.", "ok"), () => {}); } catch { /* clipboard blocked */ }
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "text/csv" })); a.download = "audit-trail.csv"; a.click(); } catch { /* downloads blocked in some viewers */ }
  };
  const full = ["dean", "principal", "coe", "hod", "auditor"].includes(me.role);
  return (
    <>
      <PageHeader crumb="Governance" title="Audit trail" sub={me.role === "student" ? "Everything that happened to your script." : me.role === "evaluator" ? "Your own actions." : "Every change to schemes, windows, marks and results, with who did it, when and why."}
        actions={full && <><Button variant="outline" onClick={() => setRes(verifyChain(s.audit) ?? "ok")}>Verify chain</Button><Button variant="outline" onClick={csv}>Export or copy CSV</Button></>} />
      {full && res !== null && (res === "ok"
        ? <Alert variant="success" className="mb-4"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /><AlertDescription>Chain verified: {s.audit.length} entries, none altered or removed. Each entry carries the SHA-256 hash of the one before it.</AlertDescription></div></Alert>
        : <Alert variant="destructive" className="mb-4"><div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /><AlertDescription>Chain broken at entry #{res}. That entry, or one before it, was changed after it was written.</AlertDescription></div></Alert>)}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup type="single" value={g} onValueChange={(v) => v && setG(v)} aria-label="Filter audit entries">{Object.keys(GROUPS).map((k) => <ToggleGroupItem key={k} value={k}>{k}</ToggleGroupItem>)}</ToggleGroup>
        {full && <Button size="sm" variant="ghost" onClick={() => { actions.tamperDemo(); setRes(null); }}>Demo: tamper with an entry</Button>}
      </div>
      <Card><CardContent className="px-0 py-2">
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Time</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>What</TableHead><TableHead>Reason</TableHead><TableHead>Hash</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((e) => (
            <TableRow key={e.seq}>
              <TableCell className="text-muted-foreground">{e.seq}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{when(e.ts)}</TableCell>
              <TableCell><div className="font-semibold">{userName(s, e.actorId)}</div><div className="text-xs text-muted-foreground">{ROLE_LABEL[e.actorRole as keyof typeof ROLE_LABEL]}</div></TableCell>
              <TableCell><Badge variant="secondary">{e.action}</Badge></TableCell>
              <TableCell className="max-w-md"><div className="font-medium">{e.target}</div><div className="text-muted-foreground">{e.detail}</div></TableCell>
              <TableCell className="max-w-xs text-muted-foreground">{e.reason ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{e.hash.slice(0, 10)}…</TableCell>
            </TableRow>))}</TableBody>
        </Table>
        {rows.length === 0 && <div className="p-8 text-center text-muted-foreground">Nothing here yet.</div>}
      </CardContent></Card>
      <p className="mt-3 text-sm text-muted-foreground">Prototype note: the log lives in your browser, so anyone with developer tools could rewrite it and its hashes. In production the chain is written by a server and anchored where the application cannot edit it.</p>
    </>
  );
}
