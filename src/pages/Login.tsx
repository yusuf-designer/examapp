import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { SimpleSelect } from "@/components/simple-select";
const emblem = new URL("../assets/emblem.svg", import.meta.url).href;
import { ACTIVE_ROLES, DEMO_STUDENT_IDS, ROLE_LABEL } from "@/lib/permissions";
import { actions, useApp } from "@/lib/store";
import type { Role, User } from "@/lib/types";

const ORDER: Role[] = ACTIVE_ROLES;
const DOMAIN = "jnmc-demo.edu";
export const emailOf = (u: User) => u.role === "student" && u.rollNo
  ? `${u.rollNo.toLowerCase().replace(/[^a-z0-9]/g, "")}@students.${DOMAIN}`
  : `${u.name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s*/, "").toLowerCase().replace(/[^a-z\s]/g, "").trim().replace(/\s+/g, ".")}@${DOMAIN}`;
const STEPS = ["Contacting college identity provider", "Checking this email is registered", "Signed in with college SSO"];

export default function Login() {
  const s = useApp();
  const [tab, setTab] = useState<"staff" | "student">("staff");
  const roles = ORDER.filter((r) => s.users.some((u) => u.role === r) && (tab === "student" ? r === "student" : r !== "student"));
  const [role, setRole] = useState<Role | "">("");
  const [uid, setUid] = useState("");
  const [step, setStep] = useState(-1);
  const people = useMemo(() => s.users.filter((u) => u.role === role), [s.users, role]);
  const [typed, setTyped] = useState("");
  const students = s.users.filter((u) => u.role === "student" && !DEMO_STUDENT_IDS.includes(u.id)); // only students added with an uploaded copy
  const prefill = students[students.length - 1]; // the student added most recently
  const user = tab === "student" ? students.find((u) => emailOf(u) === typed.trim().toLowerCase()) : s.users.find((u) => u.id === uid);
  useEffect(() => { setUid(people.length === 1 ? people[0].id : ""); setStep(-1); }, [role]);
  useEffect(() => { setStep(-1); }, [uid, typed]);
  useEffect(() => {
    if (step < 0) return;
    if (step < STEPS.length) { const t = setTimeout(() => setStep(step + 1), 650); return () => clearTimeout(t); }
    const t = setTimeout(() => actions.signIn(user!.id), 500); return () => clearTimeout(t);
  }, [step]);
  const busy = step >= 0;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden items-center justify-center bg-[#104236] lg:flex">
        <div className="relative overflow-hidden bg-[#104236] text-white" style={{ width: "min(100%, calc(100vh * 0.785))", aspectRatio: "877 / 1117", containerType: "inline-size" }}>
          <img src={emblem} alt="Aligarh Muslim University emblem" className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-x-0 text-center" style={{ top: "70%", padding: "0 7cqw" }}>
            <h2 className="font-display font-semibold tracking-tight" style={{ fontSize: "5.4cqw", lineHeight: 1.15, textWrap: "balance" }}>Fair grading for every answer</h2>
            <p className="text-white/75" style={{ fontSize: "2.5cqw", lineHeight: 1.5, marginTop: "2cqw", textWrap: "balance" }}>Examination grading portal of Aligarh Muslim University, J.N. Medical College. Every answer is marked against a locked rubric.</p>
          </div>
        </div>
      </div>
      <div className="flex min-h-screen flex-col bg-white">
        <div className="flex items-center justify-between p-6 lg:justify-end">
          <span className="font-bold lg:hidden">Exam EVAL</span>
          <span className="text-sm text-muted-foreground">Signing in to the examination portal</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-md space-y-5">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as "staff" | "student"); setRole(""); setTyped(v === "student" && prefill ? emailOf(prefill) : ""); }}>
              <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="staff" disabled={busy}>Staff</TabsTrigger><TabsTrigger value="student" disabled={busy}>Student</TabsTrigger></TabsList>
            </Tabs>
            <div className="space-y-2 pt-2 text-center">
              <h1 className="font-display text-4xl font-semibold tracking-tight">Sign in</h1>
              <p className="text-sm text-muted-foreground">{tab === "student" ? "Enter your college email and we sign you in with college SSO." : "Who are you? Pick your role and we sign you in with your college email."}</p>
            </div>
            {tab === "staff" && (<>
            <div className="space-y-2">
              <Label htmlFor="role">I am the</Label>
              <SimpleSelect id="role" label="I am the" value={role} onValueChange={(v) => setRole(v as Role)} placeholder="Choose your role" disabled={busy}
                options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
            </div>
            {people.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="person">Name</Label>
                <SimpleSelect id="person" label="Name" value={uid} onValueChange={setUid} placeholder="Choose your name" disabled={busy}
                  options={people.map((u) => ({ value: u.id, label: u.name }))} />
              </div>)}
            </>)}
            <div className="space-y-2">
              <Label htmlFor="email">{tab === "student" ? "Your college email" : "College email"}</Label>
              <div className="relative"><Mail className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                {tab === "student"
                  ? <Input id="email" type="email" autoComplete="off" disabled={busy} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={prefill ? emailOf(prefill) : "Students appear after their copy is uploaded"} className="pl-10" />
                  : <Input id="email" readOnly value={user ? emailOf(user) : ""} placeholder="Appears after you choose" className="pl-10" />}</div>
              {tab === "student" && typed.includes("@") && !user && <p className="text-xs text-destructive">No student account found for this email.</p>}
            </div>
            <Button size="lg" className="w-full" disabled={!user || busy} onClick={() => setStep(0)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Continue with college SSO
            </Button>
            {busy && (<><Separator />
              <ul className="space-y-2 text-sm" aria-live="polite">
                {STEPS.map((t, i) => (
                  <li key={t} className={`flex items-center gap-2 ${i > step ? "text-muted-foreground/50" : ""}`}>
                    {i < step ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : i === step ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-4 w-4" />}{t}
                  </li>))}
              </ul></>)}
          </div>
        </div>
        <p className="p-6 text-center text-xs text-muted-foreground">Demonstration only. No real sign-in takes place.</p>
      </div>
    </div>
  );
}
