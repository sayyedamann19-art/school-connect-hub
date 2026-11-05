export const PUSH_CHANNELS = {
  parent: { path: "/parent/notifications" },
  teacher: { path: "/teacher/updates" },
  admin: { path: "/admin/updates" },
} as const;
export type PushRole = keyof typeof PUSH_CHANNELS;

/** Same priority and inbox rules as the existing staff inbox. */
export function pushRole(roles: string[], teacherActive = false): PushRole | null {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("teacher")) return teacherActive ? "teacher" : null;
  return roles.includes("parent") ? "parent" : null;
}
export function pushRecipients(senderIsAdmin: boolean): PushRole[] {
  return ["parent", senderIsAdmin ? "teacher" : "admin"];
}
