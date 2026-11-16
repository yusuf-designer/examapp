import { computeScore, round025 } from "./rubric";
import { makeEntry } from "./audit";
import { P2_ATH_RUBRIC, P2_ATH_TEXT, P2_MODEL_ANSWER, P2_Q2E_RUBRIC, P2_Q3A_RUBRIC, P2_Q3B_RUBRIC, P2_Q3C_RUBRIC, P2_Q4_RUBRIC, P2_Q4_TEXT } from "./paper2";
import { SAMPLE_PUBLISHED_ID, SAMPLE_SCRIPT_ID, sampleFindings } from "./sample-booklet";
import type { AppState, AuditEntry, Batch, Exam, Findings, Question, Rubric, Script, User } from "./types";

export const Q3_RUBRIC: Rubric = {
  points: [
    { id: "q3p1", text: "Atrial systole: atria contract, completing ventricular filling", marks: 1.5, kind: "content" },
    { id: "q3p2", text: "Isovolumetric contraction: all valves closed, pressure rises, volume constant", marks: 1.5, kind: "deal_breaker" },
    { id: "q3p3", text: "Ejection: semilunar valves open; rapid then reduced ejection", marks: 1.5, kind: "content" },
    { id: "q3p4", text: "Isovolumetric relaxation: all valves closed, pressure falls, volume constant", marks: 1.5, kind: "deal_breaker" },
    { id: "q3p5", text: "Filling: AV valves open; rapid then reduced filling (diastasis)", marks: 1.5, kind: "content" },
  ],
  diagram: {
    required: true, marks: 1.5, minElements: 3,
    elements: ["Axes and time scale", "Aortic, LV and atrial pressure curves", "Ventricular volume curve", "AV close, AO open, AO close, AV open marked", "Heart sounds S1 and S2"],
  },
  terminology: { terms: ["isovolumetric", "end-diastolic volume", "end-systolic volume", "diastasis", "semilunar valves"], perTerm: 0.25, marks: 1 },
  caps: { dealBreakerMissing: 5, criticalError: 3 },
};
export const Q2_RUBRIC: Rubric = {
  points: [
    { id: "q2p1", text: "States the law: force of contraction rises with initial fibre length (end-diastolic volume)", marks: 1.5, kind: "deal_breaker" },
    { id: "q2p2", text: "Mechanism: stretch optimises actin–myosin overlap and calcium sensitivity", marks: 1.5, kind: "content" },
    { id: "q2p3", text: "Significance: matches right and left ventricular output, adapts to venous return", marks: 1, kind: "content" },
  ],
  diagram: { required: false, marks: 0, elements: [], minElements: 0 },
  terminology: { terms: ["preload", "end-diastolic volume", "stroke volume", "sarcomere"], perTerm: 0.25, marks: 1 },
  caps: { dealBreakerMissing: 2.5, criticalError: 1.5 },
};

export { P2_Q2E_RUBRIC, P2_Q3A_RUBRIC, P2_Q3B_RUBRIC, P2_Q3C_RUBRIC };
export const EMPTY_RUBRIC: Rubric = {
  points: [], diagram: { required: false, marks: 0, elements: [], minElements: 0 },
  terminology: { terms: [], perTerm: 0.25, marks: 0 }, caps: { dealBreakerMissing: 5, criticalError: 3 },
};

export const USERS: User[] = [
  { id: "u-dean", name: "Prof. N. Siddiqui", role: "dean" },
  { id: "u-principal", name: "Prof. F. Ahmad", role: "principal" },
  { id: "u-hod", name: "Prof. R. Hasan", role: "hod", department: "Physiology" },
  { id: "u-coe", name: "Dr. T. Ansari", role: "coe" },
  { id: "u-ev1", name: "Dr. A. Rahman", role: "evaluator", department: "Physiology" },
  { id: "u-ev2", name: "Dr. S. Khan", role: "evaluator", department: "Physiology" },
  { id: "u-ev3", name: "Dr. M. Iqbal", role: "evaluator", department: "Pharmacology" },
  { id: "u-stu1", name: "Zainab Ali", role: "student", rollNo: "2025-0417", scriptId: "PHY-1042" },
  { id: "u-stu2", name: "Imran Qureshi", role: "student", rollNo: "2025-0388", scriptId: "PHY-1037" },
  { id: "u-stu3", name: "Aisha Khan", role: "student", rollNo: "2025-0501", scriptId: SAMPLE_PUBLISHED_ID },
  { id: "u-aud", name: "Mr. K. Verma", role: "auditor" },
];
const NAMES = ["Aisha Khan", "Bilal Ahmed", "Chitra Nair", "Danish Raza", "Esha Verma", "Farhan Shaikh", "Gauri Patel", "Hamza Siddiqui", "Imran Qureshi", "Jiya Sharma", "Kabir Mirza", "Zainab Ali"];
const SCRIPT_IDS = ["PHY-1031", "PHY-1032", "PHY-1033", "PHY-1034", "PHY-1035", "PHY-1036", "PHY-1037", "PHY-1038", "PHY-1039", "PHY-1040", "PHY-1041", "PHY-1042"];

function mulberry(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const Q3_TEXT: Record<string, [string, string]> = {
  q3p1: ["Atrial systole: the atria contract and push the last blood into the ventricles, completing filling.", "Atria contract and blood goes to ventricles."],
  q3p2: ["Isovolumetric contraction: AV valves close (S1); all valves closed so pressure rises but volume stays constant.", "Ventricles contract and the AV valves close, pressure goes up."],
  q3p3: ["Ejection: when LV pressure exceeds aortic, the semilunar valves open. Rapid ejection then reduced ejection.", "Blood is pumped into the aorta."],
  q3p4: ["Isovolumetric relaxation: semilunar valves close (S2), all valves closed, pressure falls, volume constant.", "Relaxation: ventricles relax, aortic valve closes (S2)."],
  q3p5: ["Filling: AV valves open, blood enters rapidly then slowly (diastasis).", "Filling: AV valves open, blood enters rapidly then slowly."],
};
const Q2_TEXT: Record<string, [string, string]> = {
  q2p1: ["Frank–Starling law: the more the ventricle is filled in diastole, the stronger the next contraction.", "Heart contracts more when it is stretched."],
  q2p2: ["Stretching the sarcomere gives optimal actin–myosin overlap and raises troponin C calcium sensitivity.", "Stretch gives better overlap of the filaments."],
  q2p3: ["It matches output of both ventricles and lets the heart adapt to changing venous return.", "It keeps cardiac output balanced."],
};
const TERMS3 = Q3_RUBRIC.terminology.terms, TERMS2 = Q2_RUBRIC.terminology.terms;

function buildFindings(r: Rubric, qmarks: number, texts: Record<string, [string, string]>, input: Omit<Findings, "evidence" | "secondPassTotal" | "transcript">, rnd: () => number, forceFlag = false): Findings {
  const evidence: Findings["evidence"] = {}; const transcript: Findings["transcript"] = [];
  for (const p of r.points) {
    const m = input.pointMarks[p.id];
    if (m >= p.marks) { evidence[p.id] = { quote: texts[p.id][0], confidence: "high" }; transcript.push({ text: texts[p.id][0], pointId: p.id }); }
    else if (m > 0) { evidence[p.id] = { quote: texts[p.id][1], confidence: p.kind === "deal_breaker" || rnd() < 0.3 ? "low" : "medium" }; transcript.push({ text: texts[p.id][1], pointId: p.id }); }
    else { evidence[p.id] = { quote: "", confidence: rnd() < 0.8 ? "high" : "low" }; }
  }
  const base = { ...input, evidence, transcript, secondPassTotal: 0 };
  const total = computeScore(r, input, qmarks).total;
  const delta = forceFlag ? (rnd() < 0.5 ? -1.5 : 1.5) : [0, 0, 0.25, -0.25, 0.5, -0.5][Math.floor(rnd() * 6)];
  base.secondPassTotal = Math.max(0, Math.min(qmarks, round025(total + delta)));
  return base;
}

function makeScriptFindings(idx: number, rnd: () => number) {
  const ability = 0.45 + rnd() * 0.55;
  const pick = (max: number, deal: boolean) => {
    const x = rnd() + (ability - 0.6) * 0.6;
    if (x > 0.45) return max; if (x > 0.18) return round025(max * (rnd() < 0.5 ? 0.5 : 0.75)); return deal && rnd() < 0.5 ? round025(max * 0.33) : 0;
  };
  const pm3: Record<string, number> = {}; Q3_RUBRIC.points.forEach((p) => (pm3[p.id] = pick(p.marks, p.kind === "deal_breaker")));
  const diagramPresent = rnd() < 0.8; const nEl = diagramPresent ? 1 + Math.floor(rnd() * 5) : 0;
  const found3 = TERMS3.filter(() => rnd() < ability);
  const critical = rnd() < 0.08;
  const q3 = buildFindings(Q3_RUBRIC, 10, Q3_TEXT, {
    pointMarks: pm3, diagram: { present: diagramPresent, elementsFound: Q3_RUBRIC.diagram.elements.slice(0, nEl) }, termsFound: found3, criticalError: critical,
  }, rnd, idx % 5 === 3);
  if (idx % 6 === 4) q3.integrityNote = "The answer ends with a note addressed to the examiner asking for full marks. It was ignored for marking.";
  const pm2: Record<string, number> = {}; Q2_RUBRIC.points.forEach((p) => (pm2[p.id] = pick(p.marks, p.kind === "deal_breaker")));
  const q2 = buildFindings(Q2_RUBRIC, 5, Q2_TEXT, {
    pointMarks: pm2, diagram: { present: false, elementsFound: [] }, termsFound: TERMS2.filter(() => rnd() < ability), criticalError: false,
  }, rnd);
  return { q3, q2 };
}

export function makeScripts(startIdx: number, count: number, examId: string, batchId: string, seedBase = 7): Script[] {
  const out: Script[] = [];
  for (let i = 0; i < count; i++) {
    const idx = startIdx + i; const rnd = mulberry(seedBase * 1000 + idx);
    const { q2, q3 } = makeScriptFindings(idx, rnd);
    const id = `PHY-${1100 + idx}`;
    out.push({ id, barcode: `BC-${(900000 + idx * 37).toString()}`, studentId: `synthetic-${idx}`, examId, batchId, findings: { q2, q3 }, finalTotals: {} });
  }
  return out;
}

export function seedState(now = Date.now()): AppState {
  const day = 86400000; const iso = (ms: number) => new Date(ms).toISOString();
  const lockedAt = iso(now - 4 * day);
  const q = (id: string, label: string, text: string, marks: number, type: string, rubric: Rubric, locked: boolean): Question => ({
    id, label, text, marks, type, rubric, locked, modelAnswer: P2_MODEL_ANSWER[id], version: locked ? 1 : 0, lockedAt: locked ? lockedAt : undefined, lockedBy: locked ? "u-ev1" : undefined,
    history: locked ? [{ version: 1, rubric, text, lockedAt, lockedBy: "u-ev1" }] : [],
  });
  const closedWin = { state: "closed" as const, endsAt: iso(now - 3 * day) };
  const none = { state: "not_started" as const };
  const phy: Exam = {
    id: "ex-phy1", year: "Year 1 · Phase I", subject: "Physiology", paper: "Paper I", department: "Physiology",
    questions: [
      q("q2", "Question 2", "Write a short note on the Frank–Starling law of the heart. (5 marks)", 5, "Short note", Q2_RUBRIC, true),
      q("q3", "Question 3", "Describe the phases of the cardiac cycle. Draw a labelled Wiggers diagram. (10 marks)", 10, "Essay with diagram", Q3_RUBRIC, true),
    ],
    windows: { entry: closedWin, evaluation: none, recheck: none }, evaluators: ["u-ev1", "u-ev2", "u-ev3"], published: false,
  };
  const phy2: Exam = {
    id: "ex-phy2", year: "Year 1 · Phase I", subject: "Physiology", paper: "Paper II", department: "Physiology",
    questions: [
      q("q2e", "Question 2(e)", "Write a short note on the anti-inflammatory and anti-allergic effects of glucocorticoids. (5 marks)", 5, "Short note", P2_Q2E_RUBRIC, false),
      q("q3a", "Question 3(a)", "Patients with hypothyroidism cannot tolerate cold. Explain. (3 marks)", 3, "Reasoning", P2_Q3A_RUBRIC, false),
      q("q3b", "Question 3(b)", "Sterility is common in men working in hot environments. Explain. (3 marks)", 3, "Reasoning", P2_Q3B_RUBRIC, false),
      q("q3c", "Question 3(c)", "Maximum visual acuity is at the fovea centralis. Explain. (3 marks)", 3, "Reasoning", P2_Q3C_RUBRIC, false),
    ],
    windows: { entry: { state: "open", endsAt: iso(now + 3 * day) }, evaluation: none, recheck: none }, evaluators: ["u-ev1", "u-ev2"], published: false,
  };
  const phy2w: Exam = {
    id: "ex-phy2w", year: "Year 1 · Phase I", subject: "Physiology", paper: "Paper II · worked example", department: "Physiology",
    questions: [
      q("q2e", "Question 2(e)", "Write a short note on the anti-inflammatory and anti-allergic effects of glucocorticoids. (5 marks)", 5, "Short note", P2_Q2E_RUBRIC, true),
      q("q3a", "Question 3(a)", "Patients with hypothyroidism cannot tolerate cold. Explain. (3 marks)", 3, "Reasoning", P2_Q3A_RUBRIC, true),
      q("q3b", "Question 3(b)", "Sterility is common in men working in hot environments. Explain. (3 marks)", 3, "Reasoning", P2_Q3B_RUBRIC, true),
      q("q3c", "Question 3(c)", "Maximum visual acuity is at the fovea centralis. Explain. (3 marks)", 3, "Reasoning", P2_Q3C_RUBRIC, true),
    ],
    windows: { entry: closedWin, evaluation: { state: "open", endsAt: iso(now + 5 * day) }, recheck: none }, evaluators: ["u-ev1", "u-ev2"], published: false, allocationMode: "by_question",
  };
  const phy2p: Exam = {
    ...structuredClone(phy2w), id: "ex-phy2p", paper: "Paper II · published example",
    windows: { entry: closedWin, evaluation: { state: "closed", endsAt: iso(now - 1 * day) }, recheck: { state: "open", endsAt: iso(now + 5 * day) } }, published: true, signedOffBy: "u-coe",
  };
  const pha: Exam = {
    id: "ex-pha2", year: "Year 2 · Phase II", subject: "Pharmacology", paper: "Paper II", department: "Pharmacology",
    questions: [q("q1", "Question 1", "Classify antihypertensive drugs and explain the mechanism of action of ACE inhibitors. (10 marks)", 10, "Essay", { ...EMPTY_RUBRIC }, false)],
    windows: { entry: { state: "open", endsAt: iso(now + 2 * day) }, evaluation: none, recheck: none }, evaluators: ["u-ev3"], published: false,
  };
  const demo = (id: string, year: string, subject: string, paper: string, dept: string): Exam => ({
    id, year, subject, paper, department: dept, questions: [], windows: { entry: none, evaluation: none, recheck: none }, evaluators: [], published: false, demoOnly: true,
  });
  const exams = [phy, pha, phy2, phy2w, phy2p,
    demo("ex-ana1", "Year 1 · Phase I", "Anatomy", "Paper I", "Anatomy"), demo("ex-bio1", "Year 1 · Phase I", "Biochemistry", "Paper I", "Biochemistry"),
    demo("ex-path1", "Year 2 · Phase II", "Pathology", "Paper I", "Pathology"), demo("ex-cm1", "Year 3 · Phase III Part 1", "Community Medicine", "Paper I", "Community Medicine"),
    demo("ex-med1", "Year 4 · Phase III Part 2", "Medicine", "Paper I", "Medicine"),
  ];

  // 11 synthetic scripts plus the two named students, whose findings are fixed so the demo story is reproducible.
  const scripts = makeScripts(0, 12, "ex-phy1", "B-0188");
  const stu = (id: string, name: string) => { const s = scripts.find((x) => x.id === id) ?? null; return s ? { s, name } : null; };
  scripts.forEach((s, i) => { s.id = SCRIPT_IDS[i]; s.studentId = i === 11 ? "u-stu1" : i === 6 ? "u-stu2" : `syn-${NAMES[i]}`; });
  scripts.slice(6).forEach((s) => (s.batchId = "B-0189"));
  void stu;
  const zr = mulberry(4242);
  const z = scripts.find((s) => s.id === "PHY-1042")!;
  z.findings.q3 = buildFindings(Q3_RUBRIC, 10, Q3_TEXT, {
    pointMarks: { q3p1: 1.5, q3p2: 1.5, q3p3: 1.5, q3p4: 0.5, q3p5: 1 },
    diagram: { present: true, elementsFound: Q3_RUBRIC.diagram.elements.slice(0, 2) }, termsFound: TERMS3.filter((t) => t !== "diastasis"), criticalError: false,
  }, zr);
  z.findings.q3.secondPassTotal = 7;
  z.findings.q3.diagramNote = "Pressure curves and axes present. S1, S2 and valve events not labelled.";
  z.findings.q2 = buildFindings(Q2_RUBRIC, 5, Q2_TEXT, {
    pointMarks: { q2p1: 1.5, q2p2: 1, q2p3: 1 }, diagram: { present: false, elementsFound: [] }, termsFound: TERMS2.filter((t) => t !== "sarcomere"), criticalError: false,
  }, zr);
  z.findings.q2.secondPassTotal = 4.25;
  const sampleF = sampleFindings();
  const sampleScript: Script = { id: SAMPLE_SCRIPT_ID, barcode: "BC-PHY2-1001", studentId: "", examId: "ex-phy2w", batchId: "B-0201", findings: sampleF, finalTotals: {} };
  const sampleEvals = [["q2e", "u-ev2"], ["q3a", "u-ev1"], ["q3b", "u-ev1"], ["q3c", "u-ev2"]].map(([qid, examinerId]) => ({
    id: `${SAMPLE_SCRIPT_ID}:${qid}`, scriptId: SAMPLE_SCRIPT_ID, qid, examinerId, reason: "", status: "pending" as const,
    mine: structuredClone({ pointMarks: sampleF[qid].pointMarks, diagram: sampleF[qid].diagram, termsFound: sampleF[qid].termsFound, criticalError: sampleF[qid].criticalError }),
  }));
  scripts.push(sampleScript);
  // The same booklet, marked and published to a student, so a student sees the real crops with marks on them.
  const pubF = structuredClone(sampleF);
  const pubScript: Script = { id: SAMPLE_PUBLISHED_ID, barcode: "BC-PHY2-1002", studentId: "u-stu3", examId: "ex-phy2p", batchId: "B-0202", findings: pubF,
    finalTotals: Object.fromEntries(phy2p.questions.map((x) => [x.id, computeScore(x.rubric, pubF[x.id], x.marks).total])) };
  const pubEvals = phy2p.questions.map((x, i) => ({
    id: `${SAMPLE_PUBLISHED_ID}:${x.id}`, scriptId: SAMPLE_PUBLISHED_ID, qid: x.id, examinerId: i % 2 ? "u-ev1" : "u-ev2", reason: "", status: "finalised" as const, finalTotal: pubScript.finalTotals[x.id],
    mine: structuredClone({ pointMarks: pubF[x.id].pointMarks, diagram: pubF[x.id].diagram, termsFound: pubF[x.id].termsFound, criticalError: pubF[x.id].criticalError }),
  }));
  scripts.push(pubScript);
  const b: Batch[] = [
    { id: "B-0201", examId: "ex-phy2w", scripts: 1, pages: 7, quality: "Real photographs", status: "Ready", synthetic: false },
    { id: "B-0202", examId: "ex-phy2p", scripts: 1, pages: 7, quality: "Real photographs", status: "Ready", synthetic: false },
    { id: "B-0188", examId: "ex-phy1", scripts: 6, pages: 72, quality: "All readable", status: "Ready", synthetic: true },
    { id: "B-0189", examId: "ex-phy1", scripts: 6, pages: 72, quality: "All readable", status: "Ready", synthetic: true },
  ];
  const users = USERS;
  const seq: AuditEntry[] = [];
  const push = (ts: number, actor: string, action: string, target: string, detail: string, reason?: string) => {
    const u = users.find((x) => x.id === actor)!;
    seq.push(makeEntry(seq[seq.length - 1], { ts: iso(ts), actorId: actor, actorRole: u.role, action, target, detail, reason }));
  };
  push(now - 7 * day, "u-coe", "exam.created", "Physiology Paper I", "Exam created, 3 evaluators eligible");
  push(now - 7 * day + 600000, "u-coe", "window.opened", "Physiology Paper I", "Evaluator entry window opened for 3 days");
  push(now - 4 * day, "u-ev1", "scheme.locked", "Physiology Paper I · Q2", "Scheme submitted and locked as v1");
  push(now - 4 * day + 60000, "u-ev1", "scheme.locked", "Physiology Paper I · Q3", "Scheme submitted and locked as v1");
  push(now - 4 * day + 3600000, "u-coe", "window.closed", "Physiology Paper I", "Evaluator entry window closed");
  push(now - 2 * day, "u-coe", "scans.uploaded", "B-0188", "6 scripts, 72 pages (synthetic demo scans)");
  push(now - 2 * day + 600000, "u-coe", "scans.uploaded", "B-0189", "6 scripts, 72 pages (synthetic demo scans)");
  push(now - 1 * day, "u-coe", "exam.created", "Demo paper", "Exam created, 2 evaluators eligible");
  push(now - 1 * day + 600000, "u-coe", "window.opened", "Physiology Paper II", "Evaluator entry window opened for 3 days");
  push(now - 1 * day + 900000, "u-coe", "scans.uploaded", "B-0201", "1 script, 7 pages (real photographs of booklet pages 21 to 27)");
  push(now - 1 * day + 960000, "u-coe", "scripts.assigned", "Physiology Paper II · worked example", "1 script, by question, 4 answers to 2 evaluators. Evaluation window 5 days.");
  push(now - 6 * day, "u-coe", "exam.created", "Pharmacology Paper II", "Exam created, 1 evaluator eligible");
  push(now - 2 * day + 700000, "u-coe", "window.opened", "Pharmacology Paper II", "Evaluator entry window opened for 4 days");
  seq.sort((a, b) => a.ts.localeCompare(b.ts));
  // re-chain after sort
  const chained: AuditEntry[] = [];
  seq.forEach((e) => chained.push(makeEntry(chained[chained.length - 1], { ts: e.ts, actorId: e.actorId, actorRole: e.actorRole, action: e.action, target: e.target, detail: e.detail, reason: e.reason })));
  return { currentUserId: "u-coe", users, exams, scripts, batches: b, evaluations: [...sampleEvals, ...pubEvals], editRequests: [], rechecks: [], audit: chained, assignedExamIds: ["ex-phy2w", "ex-phy2p"], seq: 0 };
}

export const CLEAN_VERSION = 3;
/** The starting data for real use: one Admin, the evaluators and one exam with its scheme locked. No scripts, no students, no marks. */
export function cleanState(now = Date.now()): AppState {
  const full = seedState(now); const day = 86400000; const iso = (t: number) => new Date(t).toISOString();
  const ex = structuredClone(full.exams.find((e) => e.id === "ex-phy2w")!);
  ex.id = "ex-phy2"; ex.subject = "Physiology and Pathology"; ex.paper = "Demo paper"; delete (ex as { demoOnly?: boolean }).demoOnly;
  ex.windows = { entry: { state: "closed", endsAt: iso(now - 3 * day) }, evaluation: { state: "open", endsAt: iso(now + 7 * day) }, recheck: { state: "not_started" } };
  const lockedAt = iso(now - 2 * day);
  ex.questions = ex.questions.filter((x) => x.id !== "q3b"); // the demo book has no answer to 3(b)
  ex.questions.unshift({ id: "qath", label: "Question 2", text: P2_ATH_TEXT, marks: 10, type: "Essay", rubric: P2_ATH_RUBRIC, modelAnswer: P2_MODEL_ANSWER.qath, locked: true, version: 1, lockedAt, lockedBy: "u-ev1",
    history: [{ version: 1, rubric: P2_ATH_RUBRIC, text: P2_ATH_TEXT, lockedAt, lockedBy: "u-ev1" }] });
  ex.questions.push({ id: "q4", label: "Question 4", text: P2_Q4_TEXT, marks: 5, type: "MCQ", rubric: P2_Q4_RUBRIC, modelAnswer: P2_MODEL_ANSWER.q4, locked: true, version: 1, lockedAt, lockedBy: "u-ev1",
    history: [{ version: 1, rubric: P2_Q4_RUBRIC, text: P2_Q4_TEXT, lockedAt, lockedBy: "u-ev1" }] });
  const audit: AuditEntry[] = [];
  const push = (ts: number, action: string, target: string, detail: string) => audit.push(makeEntry(audit[audit.length - 1], { ts: iso(ts), actorId: "u-coe", actorRole: "coe", action, target, detail }));
  push(now - 3 * day, "exam.created", "Demo paper", "Exam created, 2 evaluators eligible");
  push(now - 2 * day, "scheme.locked", "Demo paper", "Marking scheme locked for all five questions");
  return { currentUserId: "u-coe", signedIn: false, users: full.users.filter((u) => u.role === "coe" || u.role === "evaluator"), exams: [ex], scripts: [], batches: [], evaluations: [],
    editRequests: [], rechecks: [], audit, assignedExamIds: [], seq: 0, dataVersion: CLEAN_VERSION };
}
