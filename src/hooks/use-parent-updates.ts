import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getUpdateNotificationPref,
  listPublishedUpdates,
  listReadUpdateIds,
  markUpdatesRead,
} from "@/lib/updates.functions";
import { computeUnread } from "@/lib/unread";

export const parentUpdatesKey = ["parent", "updates"] as const;
export const parentReadsKey = ["parent", "update-reads"] as const;
export const notifyPrefKey = ["me", "notify-updates"] as const;

/** Published updates plus which ones this parent has already read. */
export function useParentUpdates(enabled = true) {
  const updates = useQuery({
    queryKey: parentUpdatesKey,
    queryFn: () => listPublishedUpdates(),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const reads = useQuery({
    queryKey: parentReadsKey,
    queryFn: () => listReadUpdateIds(),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const readSet = new Set(reads.data ?? []);
  // Unread = published updates (the list only ever holds published rows) this parent hasn't
  // opened. Shown only once both lists have loaded, so a failed load never shows a stale dot.
  const unread =
    reads.isSuccess && updates.isSuccess
      ? computeUnread(updates.data, readSet)
      : [];
  return { updates, reads, readSet, unread };
}

export function useMarkUpdatesRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updateIds: string[]) => markUpdatesRead({ data: { updateIds } }),
    onMutate: (updateIds) => {
      queryClient.setQueryData<string[]>(parentReadsKey, (old) =>
        Array.from(new Set([...(old ?? []), ...updateIds])),
      );
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: parentReadsKey }),
  });
}

export function useNotifyPref(enabled = true) {
  return useQuery({
    queryKey: notifyPrefKey,
    queryFn: () => getUpdateNotificationPref(),
    enabled,
  });
}
