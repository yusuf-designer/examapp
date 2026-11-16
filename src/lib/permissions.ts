import type { Exam, Role, User } from "./types";
export type Perm =
  | "create_exam" | "manage_windows" | "author_scheme" | "lock_scheme" | "approve_edit" | "upload_scans"
  | "assign_scripts" | "signoff" | "publish" | "assign_recheck" | "view_all" | "read_audit_all";
const MATRIX: Record<Perm, Role[]> = {
  create_exam: ["coe", "dean", "principal"],
  manage_windows: ["coe", "dean", "principal"],
  author_scheme: [],
  lock_scheme: [],
  approve_edit: ["coe", "dean", "principal"],
  upload_scans: ["coe", "hod"],
  assign_scripts: ["coe", "hod"],
  signoff: ["coe", "dean", "principal"],
  publish: ["coe", "principal"],
  assign_recheck: ["coe"],
  view_all: ["dean", "principal", "coe", "hod", "auditor"],
  read_audit_all: ["dean", "principal", "coe", "hod", "auditor"],
};
/** Only these roles can sign in for now. The rest are suspended while this is an MVP. */
export const ACTIVE_ROLES: Role[] = ["coe", "evaluator", "student"];
export const ADMIN_ROLES: Role[] = ["dean", "principal", "hod", "coe"];
export const isAdmin = (r: Role) => ADMIN_ROLES.includes(r);
export function can(user: User, perm: Perm, exam?: Exam): boolean {
  if (!MATRIX[perm].includes(user.role)) return false;
  if (user.role === "hod" && exam && exam.department !== user.department) return false;
  return true;
}
export const ROLE_LABEL: Record<Role, string> = {
  dean: "Dean", principal: "Principal", hod: "Head of Department", coe: "Admin",
  evaluator: "Evaluator", student: "Student", auditor: "Auditor",
};
export const ROLE_SCOPE: Record<Role, string> = {
  dean: "Whole institution", principal: "Whole institution", hod: "Own department only", coe: "Everything except marking",
  evaluator: "Assigned work only", student: "Own script only", auditor: "Read-only",
};

/** Sample students that come with the demo. They cannot sign in; only students added with an uploaded copy can. */
export const DEMO_STUDENT_IDS = ["u-stu1", "u-stu2", "u-stu3"];
