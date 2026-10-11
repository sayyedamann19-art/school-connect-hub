import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { SectionCard } from "@/components/common/section-card";
import { ErrorState, LoadingCards } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMarkUpdatesRead } from "@/hooks/use-parent-updates";
import { useStaffUpdates } from "@/hooks/use-staff-updates";
import type { InboxUpdate } from "@/lib/updates.functions";

function when(u: InboxUpdate) {
  const t = u.first_published_at ?? u.published_at ?? u.created_at;
  return new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Admin/teacher notification history: updates sent to you by the other staff role. */
export function StaffInbox() {
  const { updates, reads, readSet, unread } = useStaffUpdates();
  const markRead = useMarkUpdatesRead();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<InboxUpdate | null>(null);

  const openItem = (u: InboxUpdate) => {
    setOpen(u);
    if (!readSet.has(u.id)) markRead.mutate([u.id]);
  };

  return (
    <SectionCard
      title={unread.length ? `Notifications · ${unread.length} unread` : "Notifications"}
      description="Published updates sent to you by other staff."
      action={
        unread.length ? (
          <Button
            variant="outline"
            size="sm"
            disabled={markRead.isPending}
            onClick={() => markRead.mutate(unread.map((u) => u.id))}
          >
            Mark all read
          </Button>
        ) : null
      }
    >
      {updates.isLoading || reads.isLoading ? (
        <LoadingCards count={1} />
      ) : updates.isError || reads.isError ? (
        <ErrorState
          title="Couldn't load notifications"
          description="Please try again in a moment."
          onRetry={() =>
            void queryClient.invalidateQueries({ queryKey: ["staff", "inbox"] }).then(() =>
              reads.refetch(),
            )
          }
        />
      ) : (updates.data ?? []).length === 0 ? (
        <p className="meta-text">No notifications yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {(updates.data ?? []).slice(0, 20).map((u) => {
            const isUnread = !readSet.has(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => openItem(u)}
                  className="flex w-full items-start gap-3 py-3 text-left"
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${isUnread ? "bg-danger" : "bg-transparent"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${isUnread ? "font-semibold" : ""}`}>
                      {u.title}
                    </span>
                    <span className="meta-text block">
                      {u.sender_name} · {when(u)}
                    </span>
                  </span>
                  {isUnread ? <Badge variant="outline">New</Badge> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <Dialog open onOpenChange={(next) => (next ? null : setOpen(null))}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{open.title}</DialogTitle>
              <DialogDescription>
                {open.category === "holiday" ? "Holiday" : "Notice"} · From {open.sender_name} ·{" "}
                {when(open)}
              </DialogDescription>
            </DialogHeader>
            <p className="whitespace-pre-wrap text-sm">{open.body}</p>
          </DialogContent>
        </Dialog>
      ) : null}
    </SectionCard>
  );
}
