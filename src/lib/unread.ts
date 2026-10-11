/** Published updates this parent has not opened yet. */
export function computeUnread<T extends { id: string; is_published: boolean }>(
  updates: T[],
  readIds: Iterable<string>,
): T[] {
  const read = new Set(readIds);
  return updates.filter((u) => u.is_published && !read.has(u.id));
}

export type StaffRole = "admin" | "teacher";

/**
 * Staff inbox: admins get published updates sent by teachers; active teachers get published
 * updates sent by admins. Nobody is notified about their own updates.
 */
export function staffInboxFilter<
  T extends { id: string; is_published: boolean; created_by?: string | null },
>(
  updates: T[],
  senderIsAdmin: Map<string, boolean>,
  me: string,
  role: StaffRole,
  teacherActive = true,
): T[] {
  if (role === "teacher" && !teacherActive) return [];
  return updates.filter((u) => {
    if (!u.is_published || !u.created_by || u.created_by === me) return false;
    const fromAdmin = senderIsAdmin.get(u.id);
    if (fromAdmin === undefined) return false;
    return role === "admin" ? !fromAdmin : fromAdmin;
  });
}
