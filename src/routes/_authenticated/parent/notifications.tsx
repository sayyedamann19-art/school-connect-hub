import { createFileRoute } from "@tanstack/react-router";
import { BellRing, CalendarCheck, Megaphone, MessageSquareText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { updates, type UpdateCategory } from "@/lib/mock/school-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/parent/notifications")({
  head: () => ({
    meta: [
      { title: "Updates — Dawn Breakers School" },
      {
        name: "description",
        content:
          "School notices, attendance alerts and new teacher feedback for your children at Dawn Breakers School.",
      },
      { property: "og:title", content: "Updates — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Notices, attendance alerts and feedback updates from the school.",
      },
    ],
  }),
  component: NotificationsPage,
});

const categoryMeta: Record<UpdateCategory, { icon: LucideIcon; tone: string; label: string }> = {
  school: { icon: Megaphone, tone: "bg-info-soft text-info", label: "School" },
  attendance: { icon: CalendarCheck, tone: "bg-gold-soft text-warning-foreground", label: "Attendance" },
  feedback: { icon: MessageSquareText, tone: "bg-teal-soft text-teal", label: "Feedback" },
  notice: { icon: BellRing, tone: "bg-primary-soft text-primary", label: "Notice" },
};

function NotificationsPage() {
  const unread = updates.filter((item) => item.unread);
  const earlier = updates.filter((item) => !item.unread);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Updates</h1>
        <p className="meta-text mt-1.5">
          {unread.length} unread · {updates.length} in the last 30 days
        </p>
      </header>

      {[
        { title: "New", items: unread },
        { title: "Earlier", items: earlier },
      ]
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <section key={group.title} className="space-y-3">
            <h2 className="eyebrow">{group.title}</h2>
            {group.items.map((item) => {
              const meta = categoryMeta[item.category];
              return (
                <article
                  key={item.id}
                  className={cn(
                    "card-surface flex gap-3.5 p-4",
                    item.unread && "border-teal/25 bg-teal-soft/25",
                  )}
                >
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
                    <p className="mt-1 text-sm leading-relaxed text-foreground/90">{item.body}</p>
                    <p className="meta-text mt-2">
                      {meta.label} · {item.time}
                    </p>
                  </div>
                  {item.unread ? (
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-teal" aria-label="Unread" />
                  ) : null}
                </article>
              );
            })}
          </section>
        ))}
    </div>
  );
}
