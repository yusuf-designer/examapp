import { useSyncExternalStore } from "react";
import { computeScore, diffInputs, fmt, rubricDiff, validateRubric } from "./rubric";
import { makeEntry } from "./audit";
import { ACTIVE_ROLES, can } from "./permissions";
import { CLEAN_VERSION, cleanState, makeScripts, seedState } from "./seed";
import type { AppState, Evaluation, Exam, Findings, Question, Rubric, ScoreInput, User, WindowName } from "./types";

const KEY = "exameval.state.v1";
export class ActionError extends Error {}

/** Exams added in a later version appear for people who already have saved data, without wiping it. */
/** Older clean data gets the expected answers and the newest questions, as long as no copy has been uploaded to that exam yet. */
function topUpScheme(s: AppState, seed: AppState): AppState {
  let changed = false;
  const exams = s.exams.map((e) => {
    const f = seed.exams.find((x) => x.id === e.id); if (!f) return e;
    const used = s.scripts.some((x) => x.examId === e.id);
    let qs = e.questions.map((q) => { const m = f.questions.find((x) => x.id === q.id)?.modelAnswer; if (m && !q.modelAnswer) { changed = true; return { ...q, modelAnswer: m }; } return q; });
    if (!used) { const add = f.questions.filter((x) => !qs.some((q) => q.id === x.id)); if (add.length) { changed = true; qs = [...qs, ...structuredClone(add)]; } }
    return qs === e.questions ? e : { ...e, questions: qs };
  });
  return changed ? { ...s, exams } : s;
}
export function withNewSeedExams(s: AppState): AppState {
  const seed = s.dataVersion === CLEAN_VERSION ? cleanState() : seedState();
  if (s.dataVersion === CLEAN_VERSION) s = topUpScheme(s, seed);
  const have = new Set(s.exams.map((e) => e.id)); const add = seed.exams.filter((e) => !have.has(e.id));
  const haveUsers = new Set(s.users.map((u) => u.id)); const newUsers = seed.users.filter((u) => !haveUsers.has(u.id));
  if (newUsers.length) s = { ...s, users: [...s.users, ...newUsers] };
  if (!add.length) return s;
  const ids = new Set(add.map((e) => e.id)); const scripts = seed.scripts.filter((x) => ids.has(x.examId)); const sids = new Set(scripts.map((x) => x.id));
  return {
    ...s, exams: [...s.exams, ...add], scripts: [...s.scripts, ...scripts], batches: [...s.batches, ...seed.batches.filter((x) => ids.has(x.examId))],
    evaluations: [...s.evaluations, ...seed.evaluations.filter((x) => sids.has(x.scriptId))], assignedExamIds: [...s.assignedExamIds, ...seed.assignedExamIds.filter((x) => ids.has(x))],
  };
}
/** A browser that was signed in as a suspended role is signed out when the app opens. */
function keepActiveSession(s: AppState): AppState { const u = s.users.find((x) => x.id === s.currentUserId); return s.signedIn && u && !ACTIVE_ROLES.includes(u.role) ? { ...s, signedIn: false } : s; }
function load(): AppState {
  try { const raw = localStorage.getItem(KEY); if (raw) { const old = JSON.parse(raw) as AppState; if (old.dataVersion === CLEAN_VERSION) return keepActiveSession(withNewSeedExams(old)); } } catch { /* first run or blocked storage */ }
  return cleanState();
}
let state: AppState = load();
const listeners = new Set<() => void>();
/** Everything except who is signed in on this device is shared between people. */
export const sharedPart = (s: AppState) => { const { currentUserId: _u, signedIn: _i, ...rest } = s; return rest; };
let remoteWrite: ((shared: ReturnType<typeof sharedPart>) => void) | null = null;
let lastShared = "";
function commit(next: AppState) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable: stay in memory */ }
  if (remoteWrite) { const sh = sharedPart(next); const j = JSON.stringify(sh); if (j !== lastShared) { lastShared = j; remoteWrite(sh); } }
  listeners.forEach((l) => l());
}
/** Connect a shared store. Remote changes replace the shared data but never change who is signed in here. */
export function attachRemote(write: (shared: ReturnType<typeof sharedPart>) => void) {
  remoteWrite = write; lastShared = JSON.stringify(sharedPart(state));
  return {
    seed: () => { write(sharedPart(state)); },
    receive(shared: ReturnType<typeof sharedPart>) {
      // Shared data from before the clean start is replaced by this clean data.
      if (state.dataVersion === CLEAN_VERSION && (shared as AppState).dataVersion !== CLEAN_VERSION) { lastShared = JSON.stringify(sharedPart(state)); remoteWrite?.(sharedPart(state)); return; }
      const j = JSON.stringify(shared); if (j === lastShared) return; lastShared = j;
      const merged = withNewSeedExams(shared as AppState);
      const next = { ...merged, currentUserId: state.currentUserId, signedIn: state.signedIn };
      if (merged !== shared) { const sh = sharedPart(next); lastShared = JSON.stringify(sh); remoteWrite?.(sh); }
      if (!next.users.some((u) => u.id === next.currentUserId)) next.currentUserId = next.users[0].id;
      state = next; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      listeners.forEach((l) => l());
    },
  };
}
export const getState = () => state;
export function useApp(): AppState { return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, getState); }
export const useMe = (): User => { const s = useApp(); return s.users.find((u) => u.id === s.currentUserId)!; };

const day = 86400000;
export function windowStatus(exam: Exam, name: WindowName, now = Date.now()) {
  const w = exam.windows[name];
  const expired = w.endsAt ? new Date(w.endsAt).getTime() < now : false;
  const open = w.state === "open" && !expired;
  const state = w.state === "open" && expired ? "closed" : w.state;
  const msLeft = w.endsAt ? new Date(w.endsAt).getTime() - now : 0;
  let left = "";
  if (open) { const d = Math.floor(msLeft / day), h = Math.floor((msLeft % day) / 3600000); left = d > 0 ? `${d} d ${h} h left` : `${h} h left`; }
  return { open, state, left, endsAt: w.endsAt };
}

function mutate(fn: (s: AppState, me: User) => void) {
  const s = structuredClone(state);
  const me = s.users.find((u) => u.id === s.currentUserId)!;
  fn(s, me);
  commit(s);
}
function log(s: AppState, me: User, action: string, target: string, detail: string, reason?: string) {
  s.audit.push(makeEntry(s.audit[s.audit.length - 1], { ts: new Date().toISOString(), actorId: me.id, actorRole: me.role, action, target, detail, reason: reason?.trim() || undefined }));
}
function need(cond: unknown, msg: string): asserts cond { if (!cond) throw new ActionError(msg); }
function examOf(s: AppState, id: string): Exam { const e = s.exams.find((x) => x.id === id); need(e, "Exam not found."); return e; }
function qOf(e: Exam, id: string): Question { const q = e.questions.find((x) => x.id === id); need(q, "Question not found."); return q; }
const examName = (e: Exam) => `${e.subject} ${e.paper}`;
export const userName = (s: AppState, id?: string) => s.users.find((u) => u.id === id)?.name ?? "—";

/** Reasons a human should look at this item before accepting the AI proposal. */
export function flagsFor(ev: Evaluation, f: Findings, r: Rubric, qmarks: number): string[] {
  const out: string[] = [];
  const b = computeScore(r, f, qmarks);
  r.points.forEach((p, i) => {
    const e = f.evidence[p.id];
    if (e && e.confidence === "low") out.push(`Point ${i + 1}: low AI confidence`);
    if (p.kind === "deal_breaker" && b.dealBreakersMissing.includes(p.id)) out.push(`Point ${i + 1}: deal-breaker scored 0, caps the question`);
    if (!e && (f.pointMarks[p.id] ?? 0) === 0) out.push(`Point ${i + 1}: new in this scheme version`);
  });
  if (f.criticalError) out.push("AI reports a critical error");
  if (f.integrityNote) out.push("Instruction aimed at the grader found in the answer");
  if (Math.abs(f.secondPassTotal - b.total) > 1) out.push(`Second AI pass disagrees (${fmt(f.secondPassTotal)} vs ${fmt(b.total)})`);
  if (ev.needsRereview) out.push(ev.needsRereview);
  return out;
}

function scoringPart(r: Rubric) {
  return JSON.stringify({ p: r.points.map((x) => [x.id, x.marks, x.kind]), d: r.diagram, t: r.terminology, c: r.caps });
}
/** Which evaluations would see a different mark (or have no AI evidence) if this proposed rubric replaced the current one. */
export function impactOf(s: AppState, examId: string, qid: string, proposed: Rubric): Evaluation[] {
  const e = s.exams.find((x) => x.id === examId); if (!e) return [];
  const q = e.questions.find((x) => x.id === qid); if (!q) return [];
  if (scoringPart(q.rubric) === scoringPart(proposed)) return [];
  return s.evaluations.filter((ev) => {
    if (ev.scriptId.length === 0) return false;
    const sc = s.scripts.find((x) => x.id === ev.scriptId); if (!sc || sc.examId !== examId || ev.qid !== qid) return false;
    const hasNew = proposed.points.some((p) => !q.rubric.points.find((o) => o.id === p.id));
    return hasNew || computeScore(q.rubric, ev.mine, q.marks).total !== computeScore(proposed, ev.mine, q.marks).total;
  });
}

function authorGate(s: AppState, me: User, e: Exam, q: Question) {
  need(!q.locked, "This question is locked. Request an edit instead.");
  if (me.role === "evaluator") {
    need(e.evaluators.includes(me.id), "You are not assigned to this exam.");
    need(windowStatus(e, "entry").open, "The entry window is closed. Ask the admin to open it.");
  } else need(false, "Read only. Only the assigned evaluator writes and locks the scheme.");
}

export const actions = {
  signIn(id: string) { const s = structuredClone(state); s.currentUserId = id; s.signedIn = true; commit(s); },
  signOut() { const s = structuredClone(state); s.signedIn = false; commit(s); },
  switchUser(id: string) { const s = structuredClone(state); s.currentUserId = id; commit(s); },
  /** Back to the clean start: no scripts, no students. */
  resetAll() { const keep = state.currentUserId; const s = cleanState(); s.currentUserId = s.users.some((u) => u.id === keep) ? keep : s.users[0].id; s.signedIn = state.signedIn; commit(s); },
  resetDemo() { const keep = state.currentUserId; const s = seedState(); s.currentUserId = keep; s.signedIn = state.signedIn; commit(s); },

  setWindow(examId: string, name: WindowName, open: boolean, days: number, reason: string) {
    mutate((s, me) => {
      const e = examOf(s, examId); need(can(me, "manage_windows", e), "Only the Admin manage windows.");
      need(reason.trim().length >= 5, "Give a short reason for the window change.");
      if (open) { need(days >= 1 && days <= 30, "Choose 1 to 30 days."); e.windows[name] = { state: "open", endsAt: new Date(Date.now() + days * day).toISOString() }; }
      else e.windows[name] = { state: "closed", endsAt: new Date().toISOString() };
      log(s, me, open ? "window.opened" : "window.closed", examName(e), `${name} window ${open ? `opened for ${days} day(s)` : "closed"}`, reason);
    });
  },
  saveDraft(examId: string, qid: string, text: string, rubric: Rubric) {
    mutate((s, me) => {
      const e = examOf(s, examId), q = qOf(e, qid); authorGate(s, me, e, q);
      q.text = text; q.rubric = rubric;
      log(s, me, "scheme.draft_saved", `${examName(e)} · ${q.label}`, "Draft saved");
    });
  },
  lockQuestion(examId: string, qid: string, text: string, rubric: Rubric) {
    mutate((s, me) => {
      const e = examOf(s, examId), q = qOf(e, qid); authorGate(s, me, e, q);
      const errs = validateRubric(rubric, q.marks); need(!errs.length, errs[0]);
      q.text = text; q.rubric = rubric; q.locked = true; q.version += 1; q.lockedAt = new Date().toISOString(); q.lockedBy = me.id;
      q.history.push({ version: q.version, rubric, text, lockedAt: q.lockedAt, lockedBy: me.id });
      log(s, me, "scheme.locked", `${examName(e)} · ${q.label}`, `Scheme locked as v${q.version}`);
    });
  },
  requestEdit(examId: string, qid: string, proposedRubric: Rubric, proposedText: string, reason: string) {
    mutate((s, me) => {
      const e = examOf(s, examId), q = qOf(e, qid);
      need(q.locked, "Only locked questions need an edit request.");
      need(me.role === "evaluator" && e.evaluators.includes(me.id), "Only the evaluator who wrote this scheme can request an edit.");
      need(!s.editRequests.some((r) => r.examId === examId && r.qid === qid && r.status === "pending"), "An edit request for this question is already pending.");
      need(reason.trim().length >= 10, "Explain why the edit is needed (at least 10 characters).");
      const errs = validateRubric(proposedRubric, q.marks); need(!errs.length, errs[0]);
      need(rubricDiff(q.rubric, proposedRubric).length > 0 || proposedText !== q.text, "Nothing has changed.");
      s.editRequests.push({ id: `er-${s.editRequests.length + 1}`, examId, qid, requestedBy: me.id, createdAt: new Date().toISOString(), proposedRubric, proposedText, reason, status: "pending", diff: rubricDiff(q.rubric, proposedRubric).concat(proposedText !== q.text ? ["Question wording changed"] : []) });
      log(s, me, "edit.requested", `${examName(e)} · ${q.label}`, rubricDiff(q.rubric, proposedRubric).join("; ") || "Question wording changed", reason);
    });
  },
  decideEdit(id: string, approve: boolean, reason: string) {
    mutate((s, me) => {
      const r = s.editRequests.find((x) => x.id === id); need(r && r.status === "pending", "Request not found or already decided.");
      const e = examOf(s, r.examId), q = qOf(e, r.qid);
      need(can(me, "approve_edit", e), "Only the Admin decide scheme edits.");
      need(reason.trim().length >= 5, "A reason is required.");
      r.status = approve ? "approved" : "rejected"; r.decidedBy = me.id; r.decidedAt = new Date().toISOString(); r.decisionReason = reason;
      let impacted = 0;
      if (approve) {
        const hit = impactOf(s, r.examId, r.qid, r.proposedRubric);
        q.rubric = r.proposedRubric; q.text = r.proposedText; q.version += 1; q.lockedAt = new Date().toISOString(); q.lockedBy = me.id;
        q.history.push({ version: q.version, rubric: q.rubric, text: q.text, lockedAt: q.lockedAt, lockedBy: me.id });
        for (const ev of s.evaluations) if (hit.some((h) => h.id === ev.id)) {
          ev.status = "pending"; ev.needsRereview = `Scheme changed to v${q.version}`; delete ev.finalTotal;
          const sc = s.scripts.find((x) => x.id === ev.scriptId); if (sc) delete sc.finalTotals[ev.qid];
          impacted++;
        }
        s.evaluations.forEach((ev) => { /* keep references stable */ void ev; });
      }
      log(s, me, approve ? "edit.approved" : "edit.rejected", `${examName(e)} · ${q.label}`, approve ? `Scheme is now v${q.version}. ${impacted} evaluation(s) sent back for re-review.` : "Request rejected", reason);
    });
  },
  uploadBatch(examId: string, count: number) {
    mutate((s, me) => {
      const e = examOf(s, examId); need(can(me, "upload_scans", e), "Only the Admin uploads scans.");
      need(e.id === "ex-phy1", "Demo scanning is wired up for Physiology Paper I only.");
      need(!s.assignedExamIds.includes(examId), "Scripts are already assigned. Add late scripts through a new batch after approval.");
      need(count >= 1 && count <= 24, "Choose 1 to 24 scripts.");
      const id = `B-${190 + s.batches.length}`; const start = s.scripts.length + 20;
      const scripts = makeScripts(start, count, examId, id, 11);
      scripts.forEach((x, i) => { x.id = `PHY-${1200 + start + i}`; });
      s.scripts.push(...scripts);
      s.batches.push({ id, examId, scripts: count, pages: count * 12, quality: "All readable", status: "Ready", synthetic: true });
      log(s, me, "scans.uploaded", id, `${count} scripts, ${count * 12} pages (synthetic demo scans)`);
    });
  },
  addScannedScript(examId: string, barcode: string, studentId: string, answers: Record<string, Findings>, pages: number, warnings: string[], newStudent?: { name: string; rollNo: string }) {
    mutate((s, me) => {
      const e = examOf(s, examId); need(can(me, "upload_scans", e), "Only the Admin uploads scans.");
      need(!s.assignedExamIds.includes(examId), "Scripts are already assigned. Add late scripts through a new batch after approval.");
      need(barcode.trim().length >= 3, "Give the script a barcode of at least 3 characters.");
      need(!s.scripts.some((x) => x.id === barcode.trim()), "A script with this barcode already exists.");
      need(e.questions.every((q) => answers[q.id]), "The AI result is missing an answer.");
      const id = barcode.trim(); const batchId = `B-${190 + s.batches.length}`;
      if (newStudent) {
        const name = newStudent.name.trim(), rollNo = newStudent.rollNo.trim();
        need(name.length >= 2 && rollNo.length >= 2, "Give the student’s name and roll number.");
        const uid = `u-s-${rollNo.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
        need(!s.users.some((u) => u.id === uid || (u.role === "student" && u.rollNo === rollNo)), "A student with this roll number already exists. Pick them from the list.");
        s.users.push({ id: uid, name, role: "student", rollNo, scriptId: id }); studentId = uid;
      } else if (studentId) { const u = s.users.find((x) => x.id === studentId); if (u) u.scriptId = id; }
      const finalTotals: Record<string, number> = {};
      const findings = structuredClone(answers);
      for (const q of e.questions) findings[q.id].secondPassTotal = computeScore(q.rubric, findings[q.id], q.marks).total; // one pass only, so nothing to disagree with
      s.scripts.push({ id, barcode: id, studentId, examId, batchId, findings, finalTotals });
      s.batches.push({ id: batchId, examId, scripts: 1, pages, quality: warnings.length ? `${warnings.length} warning(s)` : "All readable", status: "Read by AI", synthetic: false });
      log(s, me, "scans.read", id, `${pages} page(s) uploaded and read by AI, marks proposed for the evaluator${warnings.length ? `, ${warnings.length} warning(s)` : ""}`);
    });
  },
  assignScripts(examId: string, mode: "by_question" | "by_script", byQuestion: Record<string, string>, secondPct: number, days: number) {
    mutate((s, me) => {
      const e = examOf(s, examId); need(can(me, "assign_scripts", e), "Only the Admin assigns scripts, and only for exams in the Admin’s remit.");
      need(!s.assignedExamIds.includes(examId), "Already assigned.");
      const open = e.questions.filter((q) => !q.locked); need(!open.length, `Lock the scheme first: ${open.map((q) => q.label).join(", ")} still open.`);
      const scripts = s.scripts.filter((x) => x.examId === examId); need(scripts.length, "No scripts uploaded for this exam.");
      const pool = e.evaluators.filter((id) => s.users.find((u) => u.id === id)?.department === e.department); need(pool.length >= 2, "Need at least two eligible evaluators.");
      if (mode === "by_question") for (const q of e.questions) need(byQuestion[q.id] && pool.includes(byQuestion[q.id]), `Choose an examiner for ${q.label}.`);
      const step = secondPct > 0 ? Math.max(1, Math.round(100 / secondPct)) : 0;
      scripts.forEach((sc, si) => e.questions.forEach((q, qi) => {
        const examinerId = mode === "by_question" ? byQuestion[q.id] : pool[(si + qi) % pool.length];
        const f = sc.findings[q.id]; if (!f) return;
        const other = pool.filter((p) => p !== examinerId);
        s.evaluations.push({
          id: `${sc.id}:${q.id}`, scriptId: sc.id, qid: q.id, examinerId, mine: structuredClone({ pointMarks: f.pointMarks, diagram: f.diagram, termsFound: f.termsFound, criticalError: f.criticalError }), reason: "", status: "pending",
          secondMarkerId: step && si % step === 0 ? other[(si + qi) % other.length] : undefined,
        });
      }));
      e.allocationMode = mode; s.assignedExamIds.push(examId);
      e.windows.evaluation = { state: "open", endsAt: new Date(Date.now() + days * day).toISOString() };
      const sampled = s.evaluations.filter((x) => x.secondMarkerId).length;
      log(s, me, "scripts.assigned", examName(e), `${scripts.length} scripts, ${mode === "by_question" ? "by question" : "by script"}, ${sampled} answers sent to a second marker. Evaluation window ${days} days.`);
    });
  },
  saveEvaluation(evalId: string, mine: ScoreInput, reason: string) {
    mutate((s, me) => {
      const ev = s.evaluations.find((x) => x.id === evalId); need(ev && ev.examinerId === me.id, "This answer is not assigned to you.");
      need(ev.status === "pending", "Already finalised.");
      ev.mine = mine; ev.reason = reason;
    });
  },
  finaliseEvaluation(evalId: string, mine: ScoreInput, reason: string) {
    mutate((s, me) => finalise(s, me, evalId, mine, reason));
  },
  finaliseAllClean(examId: string) {
    let n = 0;
    mutate((s, me) => {
      const e = examOf(s, examId); need(me.role === "evaluator", "Only evaluators finalise marks.");
      need(windowStatus(e, "evaluation").open, "The evaluation window is not open.");
      for (const ev of s.evaluations.filter((x) => x.examinerId === me.id && x.status === "pending")) {
        const sc = s.scripts.find((x) => x.id === ev.scriptId)!; if (sc.examId !== examId) continue;
        const q = qOf(e, ev.qid); const f = sc.findings[ev.qid];
        if (flagsFor(ev, f, q.rubric, q.marks).length) continue;
        const ai: ScoreInput = { pointMarks: f.pointMarks, diagram: f.diagram, termsFound: f.termsFound, criticalError: f.criticalError };
        finalise(s, me, ev.id, ai, ""); n++;
      }
      need(n > 0, "Nothing without flags left to accept in bulk.");
    });
    return n;
  },
  signOff(examId: string) {
    mutate((s, me) => {
      const e = examOf(s, examId); need(can(me, "signoff", e), "Only the Admin signs off results.");
      need(s.assignedExamIds.includes(examId), "Scripts have not been assigned yet.");
      const pend = s.evaluations.filter((x) => s.scripts.find((y) => y.id === x.scriptId)?.examId === examId && x.status !== "finalised").length;
      need(pend === 0, `${pend} answer(s) are still not finalised.`);
      e.signedOffBy = me.id; log(s, me, "results.signed_off", examName(e), "All marks finalised and signed off");
    });
  },
  publishResults(examId: string, recheckDays: number) {
    mutate((s, me) => {
      const e = examOf(s, examId); need(can(me, "publish", e), "Only the Admin publish results.");
      need(e.signedOffBy, "Sign off the results first, then publish.");
      e.published = true;
      e.windows.evaluation = { state: "closed", endsAt: new Date().toISOString() };
      e.windows.recheck = { state: "open", endsAt: new Date(Date.now() + recheckDays * day).toISOString() };
      log(s, me, "results.published", examName(e), `Results published. Recheck window open for ${recheckDays} days.`);
    });
  },
  submitRecheck(scriptId: string, qid: string, category: string, comment: string, notes: { pointId?: string; text: string }[], claims: { pointId: string; myAnswer: string }[] = []) {
    mutate((s, me) => {
      const sc = s.scripts.find((x) => x.id === scriptId); need(sc && me.role === "student" && me.scriptId === scriptId, "You can only request a recheck of your own script.");
      const e = examOf(s, sc.examId); need(e.published, "Results are not published yet.");
      need(windowStatus(e, "recheck").open, "The recheck window is closed.");
      need(!s.rechecks.some((r) => r.scriptId === scriptId && r.qid === qid), "You already requested a recheck for this question.");
      need(comment.trim().length >= 10, "Explain the problem in your own words (at least 10 characters).");
      const q = qOf(e, qid);
      s.rechecks.push({ id: `rc-${s.rechecks.length + 1}`, scriptId, qid, studentId: me.id, createdAt: new Date().toISOString(), category, comment, notes, claims, status: "submitted", oldTotal: sc.finalTotals[qid] ?? 0 });
      log(s, me, "recheck.requested", `${sc.id} · ${q.label}`, `${category}. ${notes.length} note(s) and ${claims.length} own-answer claim(s) attached.`, comment);
    });
  },
  assignRecheck(id: string, evaluatorId: string) {
    mutate((s, me) => {
      const r = s.rechecks.find((x) => x.id === id); need(r && r.status !== "decided", "Recheck not found or already decided.");
      const sc = s.scripts.find((x) => x.id === r.scriptId)!; const e = examOf(s, sc.examId); need(can(me, "assign_recheck", e), "You cannot assign rechecks.");
      const first = s.evaluations.find((x) => x.scriptId === r.scriptId && x.qid === r.qid)?.examinerId;
      need(evaluatorId !== first, "The second evaluator must be different from the first marker.");
      need(e.evaluators.includes(evaluatorId), "That evaluator is not eligible for this exam.");
      r.assignedTo = evaluatorId; r.status = "assigned";
      log(s, me, "recheck.assigned", `${sc.id} · ${qOf(e, r.qid).label}`, `Assigned to ${userName(s, evaluatorId)}`);
    });
  },
  decideRecheck(id: string, input: ScoreInput, reason: string) {
    mutate((s, me) => {
      const r = s.rechecks.find((x) => x.id === id); need(r && r.status === "assigned" && r.assignedTo === me.id, "This recheck is not assigned to you.");
      need(reason.trim().length >= 10, "Write a reply the student can read (at least 10 characters).");
      const sc = s.scripts.find((x) => x.id === r.scriptId)!; const e = examOf(s, sc.examId); const q = qOf(e, r.qid);
      const b = computeScore(q.rubric, input, q.marks);
      r.status = "decided"; r.newTotal = b.total; r.decisionReason = reason; r.decidedBy = me.id; r.decisionInput = input; sc.finalTotals[r.qid] = b.total;
      log(s, me, "recheck.decided", `${sc.id} · ${q.label}`, `${fmt(r.oldTotal)} to ${fmt(b.total)}`, reason);
    });
  },
  /** Demo only: corrupt one audit entry in memory so the chain check can be seen failing. */
  tamperDemo() { const s = structuredClone(state); const i = Math.min(2, s.audit.length - 1); if (i >= 0) s.audit[i].detail += " [edited]"; commit(s); },
};

function finalise(s: AppState, me: User, evalId: string, mine: ScoreInput, reason: string) {
  const ev = s.evaluations.find((x) => x.id === evalId); need(ev && ev.examinerId === me.id, "This answer is not assigned to you.");
  need(ev.status === "pending", "Already finalised.");
  const sc = s.scripts.find((x) => x.id === ev.scriptId)!; const e = examOf(s, sc.examId); const q = qOf(e, ev.qid);
  need(windowStatus(e, "evaluation").open, "The evaluation window is closed.");
  const f = sc.findings[ev.qid];
  const ai: ScoreInput = { pointMarks: f.pointMarks, diagram: f.diagram, termsFound: f.termsFound, criticalError: f.criticalError };
  const diffs = diffInputs(q.rubric, ai, mine);
  if (diffs.length) need(reason.trim().length >= 8, "A written reason is required when you change the AI proposal.");
  for (const p of q.rubric.points) need((mine.pointMarks[p.id] ?? 0) <= p.marks, `Point marks cannot exceed ${p.marks}.`);
  const aiTotal = computeScore(q.rubric, ai, q.marks).total, total = computeScore(q.rubric, mine, q.marks).total;
  ev.mine = mine; ev.reason = reason; ev.status = "finalised"; ev.finalTotal = total; delete ev.needsRereview; sc.finalTotals[ev.qid] = total;
  log(s, me, diffs.length ? "mark.override" : "mark.finalised", `${sc.id} · ${q.label}`, `AI ${fmt(aiTotal)}, final ${fmt(total)}${diffs.length ? ". " + diffs.join("; ") : ""}`, diffs.length ? reason : undefined);
}

export function runAction<T>(fn: () => T, ok?: string | ((r: T) => string)): T | undefined {
  try { const r = fn(); if (ok) notify(typeof ok === "function" ? ok(r) : ok, "ok"); return r; }
  catch (e) { if (e instanceof ActionError) { notify(e.message, "error"); return undefined; } throw e; }
}

// tiny toast store
type Toast = { id: number; text: string; kind: "ok" | "error" };
let toasts: Toast[] = []; const tl = new Set<() => void>(); let tid = 0;
export function notify(text: string, kind: "ok" | "error") {
  const t = { id: ++tid, text, kind }; toasts = [...toasts, t]; tl.forEach((l) => l());
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); tl.forEach((l) => l()); }, kind === "error" ? 7000 : 4000);
}
export const useToasts = () => useSyncExternalStore((l) => { tl.add(l); return () => tl.delete(l); }, () => toasts);
