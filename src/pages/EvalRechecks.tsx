import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, PageHeader, useNav, when } from "@/components/shared";
import { fmt } from "@/lib/rubric";
import { useApp, useMe } from "@/lib/store";

export default function EvalRechecks() {
  const s = useApp(); const me = useMe(); const { go } = useNav(); const list = s.rechecks.filter((r) => r.assignedTo === me.id);
  return (
    <>
      <PageHeader crumb="Evaluator" title="Recheck requests assigned to me" sub="You are the second evaluator. Mark the answer fresh from the AI evidence. The first marker’s mark is hidden until you decide." />
      {list.length === 0 ? <Empty>No recheck is assigned to you.</Empty> : (
        <Card><CardContent className="px-0 py-2"><Table>
          <TableHeader><TableRow><TableHead>Script</TableHead><TableHead>Question</TableHead><TableHead>Requested</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{list.map((r) => { const exam = s.exams.find((e) => e.id === s.scripts.find((x) => x.id === r.scriptId)?.examId) ?? s.exams[0]; const q = exam.questions.find((x) => x.id === r.qid)!; return (
            <TableRow key={r.id}><TableCell className="font-semibold">{r.scriptId}</TableCell><TableCell>{q.label}</TableCell><TableCell>{when(r.createdAt)}</TableCell>
              <TableCell>{r.status === "decided" ? <Badge variant="success">Decided {fmt(r.oldTotal)} to {fmt(r.newTotal ?? 0)}</Badge> : <Badge variant="warning">Awaiting you</Badge>}</TableCell>
              <TableCell><Button size="sm" variant="outline" onClick={() => go("review", { scriptId: r.scriptId, qid: r.qid, recheckId: r.id })}>{r.status === "decided" ? "View" : "Open"}</Button></TableCell></TableRow>); })}</TableBody>
        </Table></CardContent></Card>
      )}
    </>
  );
}
