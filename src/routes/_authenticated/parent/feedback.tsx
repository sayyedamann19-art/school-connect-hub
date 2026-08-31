import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareText } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { ChildSwitcher, useActiveChild } from "@/components/parent/child-switcher";
import { children, feedback } from "@/lib/mock/school-data";

export const Route = createFileRoute("/_authenticated/parent/feedback")({
  head: () => ({
    meta: [
      { title: "Teacher feedback — Dawn Breakers School" },
      {
        name: "description",
        content:
          "Notes shared by class and subject teachers about your child's classwork, effort and behaviour at Dawn Breakers School.",
      },
      { property: "og:title", content: "Teacher feedback — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Praise, notes and points needing attention, shared by your child's teachers.",
      },
    ],
  }),
  component: FeedbackPage,
});

const toneMeta = {
  positive: { tone: "success", label: "Praise" },
  neutral: { tone: "info", label: "Note" },
  concern: { tone: "warning", label: "Needs attention" },
} as const;

function FeedbackPage() {
  const [activeId, setActiveId] = useState(children[0]!.id);
  const child = useActiveChild(activeId);
  const items = feedback.filter((item) => item.childId === child.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Teacher feedback</h1>
        <p className="meta-text mt-1.5">
          {child.name} · Class {child.className}-{child.division}
        </p>
      </header>

      <ChildSwitcher activeId={activeId} onSelect={setActiveId} />

      {items.length === 0 ? (
        <EmptyState
          title="No feedback yet"
          description="Teachers share notes here through the term."
          icon={<MessageSquareText className="size-5" strokeWidth={1.75} />}
        />
      ) : (
        <ol className="space-y-3">
          {items.map((item) => {
            const meta = toneMeta[item.tone];
            return (
              <li key={item.id} className="card-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{item.teacher}</p>
                    <p className="meta-text mt-0.5">{item.subject}</p>
                  </div>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">{item.message}</p>
                <p className="meta-text mt-3">{item.date}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
