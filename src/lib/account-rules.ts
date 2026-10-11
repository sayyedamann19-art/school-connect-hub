// Pure authorization rules for privileged account actions (logins, passwords, imports).
// Shared by the account service and its tests; no runtime imports.

export type Role = "admin" | "teacher" | "parent";

export const ACCOUNT_ACTIONS = [
  "parent_sign_in",
  "create_teacher",
  "create_student",
  "import_rows",
  "set_parent_active",
  "set_parent_password",
  "change_parent_contact",
  "create_parent",
] as const;
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number];

export const GENERIC_SIGN_IN_ERROR = "GR number or password is incorrect";
export const MAX_FAILED_ATTEMPTS = 5;
export const ATTEMPT_WINDOW_MINUTES = 15;

/** Which roles may run each action. Teachers only get the class-scoped import. */
export function canRun(action: AccountAction, roles: Role[]): boolean {
  if (action === "parent_sign_in") return true;
  if (action === "import_rows") return roles.includes("admin") || roles.includes("teacher");
  return roles.includes("admin");
}

/** Suspend/password/phone changes may only target pure parent accounts — never staff. */
export function isManageableParent(targetRoles: Role[]): boolean {
  return (
    targetRoles.includes("parent") && !targetRoles.includes("admin") && !targetRoles.includes("teacher")
  );
}

/** Teachers write only into classes they teach, and update only students already in their classes. */
export function teacherMayWriteRow(opts: {
  isAdmin: boolean;
  targetClassId: string | null;
  existingStudentClassId: string | null | undefined;
  existingStudent: boolean;
  teacherClassIds: Set<string>;
}): boolean {
  if (opts.isAdmin) return true;
  if (!opts.targetClassId || !opts.teacherClassIds.has(opts.targetClassId)) return false;
  if (opts.existingStudent) {
    return !!opts.existingStudentClassId && opts.teacherClassIds.has(opts.existingStudentClassId);
  }
  return true;
}

export function isLockedOut(recentFailures: number): boolean {
  return recentFailures >= MAX_FAILED_ATTEMPTS;
}

/** Escape LIKE wildcards so a GR lookup is an exact, case-insensitive match. */
export function exactIlike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Students who would be left with no parent login if this parent were deleted.
 * `otherParents` is how many OTHER parent accounts are linked to each student.
 */
export function soleParentStudents<T extends { otherParents: number }>(students: T[]): T[] {
  return students.filter((s) => s.otherParents === 0);
}
