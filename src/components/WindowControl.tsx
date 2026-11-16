import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, WindowPill } from "@/components/shared";
import { can } from "@/lib/permissions";
import { actions, runAction, useMe, windowStatus } from "@/lib/store";
import type { Exam, WindowName } from "@/lib/types";

export function WindowControl({ exam, name }: { exam: Exam; name: WindowName }) {
  const me = useMe(); const w = windowStatus(exam, name); const [dlg, setDlg] = useState<null | "open" | "close">(null);
  const [days, setDays] = useState(3); const [reason, setReason] = useState("");
  const allowed = can(me, "manage_windows", exam);
  const go = () => { const ok = runAction(() => { actions.setWindow(exam.id, name, dlg === "open", days, reason); return true; }, "Window updated."); if (ok) { setDlg(null); setReason(""); } };
  return (
    <div className="space-y-2">
      <WindowPill exam={exam} name={name} />
      {allowed && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDlg("open")}>{w.open ? "Extend" : "Open"}</Button>
          {w.open && <Button size="sm" variant="ghost" onClick={() => setDlg("close")}>Close now</Button>}
        </div>
      )}
      <Dialog open={dlg !== null} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dlg === "open" ? (w.open ? "Extend" : "Open") : "Close"} the {name} window</DialogTitle><DialogDescription>{exam.subject} {exam.paper}. This is written to the audit trail with your reason.</DialogDescription></DialogHeader>
          {dlg === "open" && <Field label="Open for how many days from now?" htmlFor="wd"><Input id="wd" type="number" min={1} max={30} value={days} onChange={(e) => setDays(parseInt(e.target.value) || 1)} /></Field>}
          <Field label="Reason (required)" htmlFor="wr"><Textarea id="wr" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: late scripts arrived" /></Field>
          <DialogFooter><Button variant="outline" onClick={() => setDlg(null)}>Cancel</Button><Button onClick={go}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
