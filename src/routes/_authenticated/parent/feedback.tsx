import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareText } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { ChildSwitcher } from "@/components/parent/child-switcher";
import { getMyChildren, getStudentNotes } from "@/lib/school.functions";

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

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function FeedbackPage() {
  const [activeId, setActiveId] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["parent", "children"],
    queryFn: () => getMyChildren(),
  });

  const childrenList = childrenQuery.data?.children ?? [];
  const activeChildId = activeId ?? childrenList[0]?.id ?? null;
  const child = childrenList.find((row) => row.id === activeChildId) ?? null;

  const notesQuery = useQuery({
    queryKey: ["parent", "student-notes", activeChildId],
    enabled: Boolean(activeChildId),
    queryFn: () => getStudentNotes({ data: { studentId: activeChildId! } }),
  });

  if (childrenQuery.isLoading) return <LoadingCards count={2} />;

  if (childrenQuery.isError) {
    return (
      <ErrorState
        title="We couldn't load teacher feedback"
        description="Please try again in a moment."
        onRetry={() => void childrenQuery.refetch()}
      />
    );
  }

  if (!child) {
    return (
      <EmptyState
        title="No children linked to your account yet"
        description="Please contact the school office so your child's record can be linked to this login."
      />
    );
  }

  const notes = notesQuery.data?.notes ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Teacher feedback</h1>
        <p className="meta-text mt-1.5">
          {child.full_name}
          {child.class
            ? ` · Class ${child.class.division ? `${child.class.name}-${child.class.division}` : child.class.name}`
            : ""}
        </p>
      </header>

      <ChildSwitcher
        childrenList={childrenList.map((row) => ({
          id: row.id,
          full_name: row.full_name,
          photoUrl: row.photoUrl,
        }))}
        activeId={child.id}
        onSelect={setActiveId}
      />

      {notesQuery.isLoading ? (
        <LoadingCards count={2} />
      ) : notesQuery.isError ? (
        <ErrorState
          title="We couldn't load teacher feedback"
          description="Please try again in a moment."
          onRetry={() => void notesQuery.refetch()}
        />
      ) : notes.length === 0 ? (
        <EmptyState
          title="No feedback yet"
          description="Teachers share notes here through the term."
          icon={<MessageSquareText className="size-5" strokeWidth={1.75} />}
        />
      ) : (
        <ol className="space-y-3">
          {notes.map((item) => (
            <li key={item.id} className="card-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{item.teacher_name}</p>
                  {item.subject ? <p className="meta-text mt-0.5">{item.subject}</p> : null}
                </div>
                <p className="meta-text shrink-0">{formatDate(item.note_date)}</p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/90">{item.note}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
