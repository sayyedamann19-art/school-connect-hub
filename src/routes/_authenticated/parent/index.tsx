import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ChevronRight, Heart, MessageSquareText, Sparkle } from "lucide-react";
import { useState } from "react";

import { ChildSwitcher } from "@/components/parent/child-switcher";
import { AttendanceRing } from "@/components/parent/progress-visuals";
import { StudentAvatar } from "@/components/common/student-card";
import { StatusBadge } from "@/components/common/status-badge";
import { CountTile } from "@/components/common/stat-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { getMyChildren } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/parent/")({
  head: () => ({
    meta: [
      { title: "Parent home — Dawn Breakers School" },
      {
        name: "description",
        content:
          "Today's attendance, recent teacher feedback and character card progress for your children at Dawn Breakers School.",
      },
      { property: "og:title", content: "Parent home — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Attendance, teacher feedback and character progress for your children.",
      },
    ],
  }),
  component: ParentHome,
});

function classLine(child: { class: { name: string; division: string | null } | null }) {
  if (!child.class) return "Class not assigned";
  return child.class.division
    ? `Class ${child.class.name}-${child.class.division}`
    : `Class ${child.class.name}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ParentHome() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent", "children"],
    queryFn: () => getMyChildren(),
  });

  if (isLoading) return <LoadingCards count={3} />;

  if (isError) {
    return (
      <ErrorState
        title="We couldn't load your children"
        description="Please try again in a moment."
        onRetry={() => void refetch()}
      />
    );
  }

  const childrenList = data?.children ?? [];

  if (childrenList.length === 0) {
    return (
      <div className="space-y-5">
        <header>
          <p className="eyebrow">Welcome</p>
          <h1 className="page-title mt-1">{data?.parentName ?? "Parent"}</h1>
        </header>
        <EmptyState
          title="No children linked to your account yet"
          description="Please contact the school office so your child's record can be linked to this login."
        />
      </div>
    );
  }

  const child = childrenList.find((entry) => entry.id === activeId) ?? childrenList[0]!;
  const attendance = child.attendance;

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Good morning</p>
          <h1 className="page-title mt-1 truncate">{data?.parentName ?? "Parent"}</h1>
        </div>
      </header>

      <ChildSwitcher childrenList={childrenList} activeId={child.id} onSelect={setActiveId} />

      <section className="card-surface overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border p-5">
          <StudentAvatar
            name={child.full_name}
            src={child.photoUrl}
            tone="teal"
            className="size-14"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-foreground">{child.full_name}</p>
            <p className="meta-text mt-0.5">
              {classLine(child)}
              {child.roll_number ? ` · Roll ${child.roll_number}` : ""} · GR {child.gr_number}
            </p>
          </div>
          <Link to="/parent/student/$studentId" params={{ studentId: child.id }}>
            <StatusBadge tone="primary">View profile</StatusBadge>
          </Link>
        </div>

        <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center sm:gap-7">
          <AttendanceRing percent={attendance.percent ?? 0} />
          <div className="w-full space-y-3">
            <div>
              <p className="section-title">
                {attendance.total === 0
                  ? "No attendance recorded yet"
                  : attendance.percent !== null && attendance.percent >= 90
                    ? "Excellent attendance"
                    : attendance.percent !== null && attendance.percent >= 75
                      ? "Attendance needs a little care"
                      : "Attendance needs attention"}
              </p>
              <p className="meta-text mt-1">
                {attendance.total} day{attendance.total === 1 ? "" : "s"} recorded
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <CountTile label="Present" value={attendance.present} tone="teal" />
              <CountTile label="Absent" value={attendance.absent} tone="coral" />
              <CountTile label="Late" value={attendance.late} tone="gold" />
              <CountTile label="Left early" value={attendance.leftEarly} tone="info" />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/parent/attendance" className="card-surface flex items-center gap-3.5 p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-teal-soft text-teal">
            <CalendarCheck className="size-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">Attendance</span>
            <span className="meta-text">Month calendar and history</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </Link>
        <Link to="/parent/character" className="card-surface flex items-center gap-3.5 p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gold-soft text-warning-foreground">
            <Heart className="size-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">Character card</span>
            <span className="meta-text">{child.characterScore} points recorded</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">Recent teacher feedback</h2>
          <Link to="/parent/feedback" className="text-xs font-bold text-teal">
            View all
          </Link>
        </div>
        {child.recentNotes.map((item) => (
          <article key={item.id} className="card-surface p-4">
            <p className="meta-text">
              {item.subject ? `${item.subject} · ` : ""}
              {formatDate(item.note_date)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{item.note}</p>
          </article>
        ))}
        {child.recentNotes.length === 0 ? (
          <div className="card-quiet flex items-center gap-3 p-4">
            <MessageSquareText className="size-4 text-muted-foreground" strokeWidth={1.75} />
            <p className="meta-text">No feedback shared yet this term.</p>
          </div>
        ) : null}
      </section>

      <section className="card-quiet flex items-start gap-3 p-4">
        <Sparkle className="mt-0.5 size-4 shrink-0 text-gold" strokeWidth={1.75} />
        <p className="meta-text">
          Attendance and feedback are published by class teachers through the school day. Records are
          private to your family.
        </p>
      </section>
    </div>
  );
}
