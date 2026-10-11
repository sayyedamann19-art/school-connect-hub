import { useQuery } from "@tanstack/react-query";

import { listReadUpdateIds, listStaffInbox } from "@/lib/updates.functions";
import { computeUnread } from "@/lib/unread";

export const staffInboxKey = ["staff", "inbox"] as const;
export const staffReadsKey = ["parent", "update-reads"] as const; // same per-user read store

/** Admin/teacher inbox (server-filtered by role) plus this user's read status. */
export function useStaffUpdates(enabled = true) {
  const updates = useQuery({
    queryKey: staffInboxKey,
    queryFn: () => listStaffInbox(),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const reads = useQuery({
    queryKey: staffReadsKey,
    queryFn: () => listReadUpdateIds(),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const readSet = new Set(reads.data ?? []);
  const unread =
    reads.isSuccess && updates.isSuccess ? computeUnread(updates.data, readSet) : [];
  return { updates, reads, readSet, unread };
}
