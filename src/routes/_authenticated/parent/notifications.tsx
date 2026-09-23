import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellRing, CalendarCheck, Megaphone, MessageSquareText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { listPublishedUpdates, type SchoolUpdate } from "@/lib/updates.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/parent/notifications")({
  head: () => ({
    meta: [
      { title: "Updates — Dawn Breakers School" },
      {
        name: "description",
        content:
          "School notices and announcements published by Dawn Breakers School for parents.",
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

const categoryMeta: Record<SchoolUpdate["category"], { icon: LucideIcon; tone: string; label: string }> = {
  school: { icon: Megaphone, tone: "bg-info-soft text-info", label: "School" },
  attendance: { icon: CalendarCheck, tone: "bg-gold-soft text-warning-foreground", label: "Attendance" },
  feedback: { icon: MessageSquareText, tone: "bg-teal-soft text-teal", label: "Feedback" },
  notice: { icon: BellRing, tone: "bg-primary-soft text-primary", label: "Notice" },
};

function formatWhen(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function NotificationsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent", "updates"],
    queryFn: () => listPublishedUpdates(),
  });

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

  const updates = data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Updates</h1>
        <p className="meta-text mt-1.5">
          {updates.length === 0
            ? "No updates published yet"
            : `${updates.length} update${updates.length === 1 ? "" : "s"} from the school`}
        </p>
      </header>

      {updates.length === 0 ? (
        <EmptyState
          title="No updates yet"
          description="School notices will appear here as soon as the office publishes them."
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
                  <p className="text-sm font-bold text-foreground">{item.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {item.body}
                  </p>
                  <p className="meta-text mt-2">
                    {meta.label} · {formatWhen(item.published_at ?? item.created_at)}
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
