import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, FileText, FolderInput, GitPullRequest, History, LayoutDashboard, LogOut, RotateCcw, Trophy, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { NavCtx, type Route } from "@/components/shared";
import { ADMIN_ROLES, ROLE_LABEL } from "@/lib/permissions";
import { actions, useApp, useMe } from "@/lib/store";
import type { Role } from "@/lib/types";
import Dashboard from "@/pages/Dashboard";
import Scripts from "@/pages/Scripts";
import Schemes from "@/pages/Schemes";
import Requests from "@/pages/Requests";
import Results from "@/pages/Results";
import ReviewList from "@/pages/ReviewList";
import Review from "@/pages/Review";
import EvalRechecks from "@/pages/EvalRechecks";
import Student from "@/pages/Student";
import Audit from "@/pages/Audit";
import Login, { emailOf } from "@/pages/Login";
import { Badge } from "@/components/ui/badge";
import { startSync, type SyncStatus } from "@/lib/sync";

const NAV: Record<string, { page: string; label: string; icon: typeof FileText }[]> = {
  admin: [{ page: "dashboard", label: "Dashboard", icon: LayoutDashboard }, { page: "scripts", label: "Scripts", icon: FolderInput }, { page: "schemes", label: "Marking schemes", icon: FileText }, { page: "requests", label: "Edit requests", icon: GitPullRequest }, { page: "results", label: "Results and rechecks", icon: Trophy }, { page: "audit", label: "Audit trail", icon: History }],
  evaluator: [{ page: "review-list", label: "My marking", icon: ClipboardCheck }, { page: "rechecks", label: "Rechecks", icon: Undo2 }, { page: "schemes", label: "Marking schemes", icon: FileText }, { page: "requests", label: "My edit requests", icon: GitPullRequest }, { page: "audit", label: "My activity", icon: History }],
  student: [{ page: "student", label: "My graded script", icon: ClipboardCheck }, { page: "audit", label: "History of my script", icon: History }],
  auditor: [{ page: "dashboard", label: "Dashboard", icon: LayoutDashboard }, { page: "audit", label: "Audit trail", icon: History }],
};
const group = (r: Role) => (ADMIN_ROLES.includes(r) ? "admin" : r);
const HOME: Record<string, string> = { admin: "dashboard", evaluator: "review-list", student: "student", auditor: "dashboard" };

export default function App() {
  const s = useApp(); const me = useMe();
  const [route, setRoute] = useState<Route>({ page: HOME[group(me.role)] });
  useEffect(() => { setRoute({ page: HOME[group(me.role)] }); }, [me.id]);
  const [sync, setSync] = useState<SyncStatus>("off");
  useEffect(() => { startSync(setSync); }, []);
  const nav = useMemo(() => ({ route, go: (page: string, params?: Record<string, string>) => { setRoute({ page, params }); window.scrollTo({ top: 0 }); } }), [route]);
  const items = NAV[group(me.role)];
  const page = (() => {
    switch (route.page) {
      case "dashboard": return <Dashboard />; case "scripts": return <Scripts />; case "schemes": return <Schemes />; case "requests": return <Requests />;
      case "results": return <Results />; case "review-list": return <ReviewList />; case "review": return <Review />; case "rechecks": return <EvalRechecks />;
      case "student": return <Student />; case "audit": return <Audit />; default: return <Dashboard />;
    }
  })();
  const active = route.page === "review" ? (route.params?.recheckId ? "rechecks" : "review-list") : route.page;
  if (!s.signedIn) return <><Login /><Toaster /></>;
  return (
    <TooltipProvider delayDuration={150}>
    <NavCtx.Provider value={nav}>
      <div className="min-h-screen">
        <header className="border-b border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
            <div className="font-display text-lg font-semibold">ExamEval AI</div>
            <div className="flex flex-wrap items-center gap-3">
              {sync === "shared" && <Badge variant="success">Shared with everyone</Badge>}{sync === "connecting" && <Badge variant="muted">Connecting…</Badge>}{sync === "error" && <Badge variant="warning">Not shared: this device only</Badge>}
              <div className="text-right text-sm leading-tight"><div className="font-medium">{me.name}</div><div className="text-xs text-muted-foreground">{ROLE_LABEL[me.role]} · {emailOf(me)}</div></div>
              <Button variant="outline" size="sm" onClick={() => actions.signOut()}><LogOut className="h-4 w-4" />Sign out</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="sm" ><RotateCcw className="h-4 w-4" />Reset demo</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Clear everything and start fresh?</AlertDialogTitle><AlertDialogDescription>This deletes every uploaded copy, student, mark and request for everyone using this page and goes back to the clean start.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => actions.resetAll()}>Reset</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </header>
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
          <nav aria-label="Main" className="flex h-fit shrink-0 gap-1 overflow-x-auto rounded-3xl border border-border/70 bg-card p-3 shadow-sm lg:w-64 lg:flex-col">
            {items.map(({ page: p, label, icon: Icon }) => (
              <button key={p} onClick={() => nav.go(p)} className={`flex min-h-[44px] items-center gap-3 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${active === p ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`} aria-current={active === p ? "page" : undefined}>
                <Icon className="h-4 w-4" />{label}
              </button>))}
          </nav>
          <main className="min-w-0 flex-1">{page}</main>
        </div>
        <Toaster />
      </div>
    </NavCtx.Provider>
    </TooltipProvider>
  );
}
