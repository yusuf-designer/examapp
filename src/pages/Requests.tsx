import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Empty, PageHeader, when } from "@/components/shared";
import { can } from "@/lib/permissions";
import { actions, getState, impactOf, runAction, userName, useApp, useMe } from "@/lib/store";

export default function Requests() {
  const s = useApp(); const me = useMe(); const [sel, setSel] = useState<{ id: string; approve: boolean } | null>(null); const [reason, setReason] = useState("");
  const list = [...s.editRequests].reverse().filter((r) => me.role === "evaluator" ? r.requestedBy === me.id : true);
  return (
    <>
      <PageHeader crumb="Governance" title="Scheme edit requests" sub="A locked scheme only changes through a written request, a decision by the Admin, and a new version. Everything is logged." />
      {list.length === 0 && <Empty>No edit requests yet. Open a locked scheme and choose “Request an edit”.</Empty>}
      <div className="space-y-5">
        {list.map((r) => {
          const e = s.exams.find((x) => x.id === r.examId)!; const q = e.questions.find((x) => x.id === r.qid)!;
          const diff = r.diff;
          const impact = r.status === "pending" ? impactOf(getState(), r.examId, r.qid, r.proposedRubric).length : null;
          return (
            <Card key={r.id} className={r.status === "pending" ? "border-l-4 border-l-warning" : ""}>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div><CardTitle>{userName(s, r.requestedBy)} asks to edit {e.subject} {e.paper} · {q.label}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Requested {when(r.createdAt)}</p></div>
                <Badge variant={r.status === "pending" ? "warning" : r.status === "approved" ? "success" : "destructive"}>{r.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><div className="text-sm font-semibold">What changes</div><ul className="mt-1 list-disc pl-5 text-sm">{(diff.length ? diff : ["Question wording"]).map((d) => <li key={d}>{d}</li>)}</ul></div>
                <div><div className="text-sm font-semibold">Reason given</div><p className="text-sm">{r.reason}</p></div>
                {impact !== null && <div className="rounded-2xl bg-muted p-3 text-sm"><b>Impact if approved:</b> {impact} marked answer(s) are re-opened for review. Unchanged marks stay valid.</div>}
                {r.status !== "pending" && <div className="rounded-2xl bg-muted p-3 text-sm"><b>{userName(s, r.decidedBy)}</b> {r.status} on {when(r.decidedAt)}: {r.decisionReason}</div>}
                {r.status === "pending" && (can(me, "approve_edit", e)
                  ? <div className="flex gap-3"><Button onClick={() => { setSel({ id: r.id, approve: true }); setReason(""); }}>Approve and create new version</Button><Button variant="outline" onClick={() => { setSel({ id: r.id, approve: false }); setReason(""); }}>Reject</Button></div>
                  : <p className="text-sm text-muted-foreground">Waiting for the Admin.</p>)}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{sel?.approve ? "Approve" : "Reject"} this request</DialogTitle><DialogDescription>Your reason is saved in the audit trail and shown to the requester.</DialogDescription></DialogHeader>
          <Textarea aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" />
          <DialogFooter><Button variant="outline" onClick={() => setSel(null)}>Cancel</Button>
            <Button variant={sel?.approve ? "default" : "destructive"} onClick={() => { if (!sel) return; const ok = runAction(() => { actions.decideEdit(sel.id, sel.approve, reason); return true; }, sel.approve ? "Approved. New version created." : "Rejected."); if (ok) setSel(null); }}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
