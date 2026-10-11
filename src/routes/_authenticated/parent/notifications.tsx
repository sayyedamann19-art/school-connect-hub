import { createFileRoute } from "@tanstack/react-router";
import { BellRing, CalendarHeart } from "lucide-react";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { useMarkUpdatesRead, useParentUpdates } from "@/hooks/use-parent-updates";
import type { UpdateCategory } from "@/lib/updates.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/parent/notifications")({
  head: () => ({
    meta: [
      { title: "Updates — Dawn Breakers School" },
      {
        name: "description",
        content: "School notices and announcements published by Dawn Breakers School for parents.",
      },
      { property: "og:title", content: "Updates — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Notices and announcements published by the school.",
      },
    ],
  }),
  component: NotificationsPage,
});

const categoryMeta: Record<UpdateCategory, { icon: LucideIcon; tone: string; label: string }> = {
  notice: { icon: BellRing, tone: "bg-primary-soft text-primary", label: "Notice" },
  holiday: { icon: CalendarHeart, tone: "bg-gold-soft text-warning-foreground", label: "Holiday" },
};

const filters = [
  { value: "all", label: "All" },
  { value: "notice", label: "Notice" },
  { value: "holiday", label: "Holiday" },
] as const;

function formatWhen(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function NotificationsPage() {
  const { updates: query, readSet, unread } = useParentUpdates();
  const { data, isLoading, isError, refetch } = query;
  const markRead = useMarkUpdatesRead();
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  // Remember which were unread when the page opened, so the "New" tag stays visible this visit.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const unreadIds = unread.map((u) => u.id).join(",");
  useEffect(() => {
    if (!unreadIds) return;
    const ids = unreadIds.split(",");
    setNewIds((prev) => new Set([...prev, ...ids]));
    markRead.mutate(ids.slice(0, 200));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds]);

  if (isLoading) return <LoadingCards count={3} />;

  if (isError) {
    return (
      <ErrorState
        title="We couldn't load updates"
        description="Please try again in a moment."
        onRetry={() => void refetch()}
      />
    );
  }

  const all = data ?? [];
  const updates = filter === "all" ? all : all.filter((u) => u.category === filter);
  void readSet;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Updates</h1>
        <p className="meta-text mt-1.5">
          {all.length === 0
            ? "No updates published yet"
            : `${all.length} update${all.length === 1 ? "" : "s"} from the school`}
        </p>
      </header>

      {all.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter updates">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-semibold transition-colors",
                filter === item.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {updates.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? "No updates yet" : "Nothing in this category"}
          description={
            all.length === 0
              ? "School notices will appear here as soon as the school publishes them."
              : "Try another filter to see other updates."
          }
          icon={<BellRing className="size-5" strokeWidth={1.75} />}
        />
      ) : (
        <section className="space-y-3">
          {updates.map((item) => {
            const meta = categoryMeta[item.category];
            return (
              <article key={item.id} className={cn("card-surface flex gap-3.5 p-4")}>
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    meta.tone,
                  )}
                >
                  <meta.icon className="size-[1.125rem]" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                    {item.title}
                    {newIds.has(item.id) ? (
                      <span className="rounded-full bg-danger px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-danger-foreground">
                        New
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {item.body}
                  </p>
                  <p className="meta-text mt-2">
                    {meta.label} ·{" "}
                    {formatWhen(item.first_published_at ?? item.published_at ?? item.created_at)}
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
