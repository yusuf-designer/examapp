export type Role = "dean" | "principal" | "hod" | "coe" | "evaluator" | "student" | "auditor";
export type WindowName = "entry" | "evaluation" | "recheck";
export type WindowState = "not_started" | "open" | "closed";
export type Confidence = "high" | "medium" | "low";

export interface User { id: string; name: string; role: Role; department?: string; rollNo?: string; scriptId?: string }

export interface RubricPoint { id: string; text: string; marks: number; kind: "content" | "deal_breaker" }
export interface Rubric {
  points: RubricPoint[];
  diagram: { required: boolean; marks: number; elements: string[]; minElements: number };
  terminology: { terms: string[]; perTerm: number; marks: number };
  caps: { dealBreakerMissing: number; criticalError: number };
}
export interface QuestionVersion { version: number; rubric: Rubric; text: string; lockedAt: string; lockedBy: string }
export interface Question {
  id: string; label: string; text: string; marks: number; type: string;
  /** The expected answer in plain sentences, shown beside the marking points. */
  modelAnswer?: string;
  rubric: Rubric; locked: boolean; version: number; lockedAt?: string; lockedBy?: string; history: QuestionVersion[];
}
export interface WindowInfo { state: WindowState; endsAt?: string }
export interface Exam {
  id: string; year: string; subject: string; paper: string; department: string;
  questions: Question[]; windows: Record<WindowName, WindowInfo>;
  evaluators: string[]; signedOffBy?: string; published: boolean; demoOnly?: boolean;
  allocationMode?: "by_question" | "by_script" | "manual";
}

/** What the AI (or an examiner) reports about one answer. The rubric engine turns this into marks. */
export interface ScoreInput {
  pointMarks: Record<string, number>;
  diagram: { present: boolean; elementsFound: string[] };
  termsFound: string[];
  criticalError: boolean;
}
export interface Evidence { quote: string; confidence: Confidence; reason?: string }
export interface Findings extends ScoreInput {
  evidence: Record<string, Evidence>;
  integrityNote?: string;
  secondPassTotal: number;
  transcript: { text: string; pointId?: string; page?: number; y0?: number; y1?: number }[];
  diagramNote?: string;
}

export interface Breakdown {
  content: number; contentMax: number;
  diagram: number; diagramMax: number; diagramNote: string;
  terminology: number; terminologyMax: number; missedTerms: string[];
  dealBreakersMissing: string[]; criticalError: boolean;
  cap: number | null; capReason: string;
  raw: number; total: number; max: number;
}

export interface Script {
  id: string; barcode: string; studentId: string; examId: string; batchId: string;
  findings: Record<string, Findings>;
  finalTotals: Record<string, number>;
}
export interface Batch { id: string; examId: string; scripts: number; pages: number; quality: string; status: string; synthetic: boolean }
export interface Evaluation {
  id: string; scriptId: string; qid: string; examinerId: string;
  mine: ScoreInput; reason: string; status: "pending" | "finalised"; finalTotal?: number; needsRereview?: string;
  secondMarkerId?: string;
}
export interface EditRequest {
  id: string; examId: string; qid: string; requestedBy: string; createdAt: string;
  proposedRubric: Rubric; proposedText: string; reason: string; diff: string[];
  status: "pending" | "approved" | "rejected"; decidedBy?: string; decidedAt?: string; decisionReason?: string;
}
export interface Recheck {
  id: string; scriptId: string; qid: string; studentId: string; createdAt: string;
  category: string; comment: string; notes: { pointId?: string; text: string }[];
  claims?: { pointId: string; myAnswer: string }[];
  status: "submitted" | "assigned" | "decided"; assignedTo?: string;
  oldTotal: number; newTotal?: number; decisionReason?: string; decidedBy?: string; decisionInput?: ScoreInput;
}
export interface AuditEntry {
  seq: number; ts: string; actorId: string; actorRole: string; action: string; target: string;
  detail: string; reason?: string; prevHash: string; hash: string;
}
export interface AppState {
  signedIn?: boolean; currentUserId: string; users: User[]; exams: Exam[]; scripts: Script[]; batches: Batch[];
  evaluations: Evaluation[]; editRequests: EditRequest[]; rechecks: Recheck[]; audit: AuditEntry[];
  assignedExamIds: string[]; seq: number;
  /** 2 = the clean starting data (no demo scripts or students). Anything older is replaced by it. */
  dataVersion?: number;
}
