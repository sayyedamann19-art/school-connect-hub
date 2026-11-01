/**
 * Shared child-selection state for the parent portal.
 *
 * The selected child travels in the URL as `?child=<studentId>` so it survives
 * navigation between sections, back/forward and refresh. Every consumer MUST
 * resolve the value against the parent's own linked children (pickChild) — a
 * stale or tampered id silently falls back to the first linked child.
 */
export type ChildSearch = { child: string };

/** Search-param validator (plain function; keeps the selection in the URL). */
export function validateChildSearch(search: Record<string, unknown>): ChildSearch {
  return { child: typeof search["child"] === "string" ? search["child"] : "" };
}

/** Resolve a requested child id against the parent's linked children. */
export function pickChild<T extends { id: string }>(requested: string, children: T[]): T | undefined {
  if (children.length === 0) return undefined;
  return children.find((child) => child.id === requested) ?? children[0];
}

/** Navigation search updater that sets the child while preserving other params. */
export function withChild(id: string) {
  return (prev: ChildSearch): ChildSearch => ({ ...prev, child: id });
}
