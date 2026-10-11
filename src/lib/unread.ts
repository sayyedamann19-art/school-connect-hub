/** Published updates this parent has not opened yet. */
export function computeUnread<T extends { id: string; is_published: boolean }>(
  updates: T[],
  readIds: Iterable<string>,
): T[] {
  const read = new Set(readIds);
  return updates.filter((u) => u.is_published && !read.has(u.id));
}
