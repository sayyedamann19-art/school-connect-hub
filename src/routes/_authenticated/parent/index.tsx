import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ChevronRight, Heart, MessageSquareText, Sparkle } from "lucide-react";
import { useState } from "react";

import { ChildSwitcher, useActiveChild } from "@/components/parent/child-switcher";
import { AttendanceRing } from "@/components/parent/progress-visuals";
import { StudentAvatar } from "@/components/common/student-card";
import { StatusBadge } from "@/components/common/status-badge";
import { CountTile } from "@/components/common/stat-card";
import {
  attendanceByChild,
  characterByChild,
  children,
  feedback,
  parentName,
  updates,
} from "@/lib/mock/school-data";

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

const toneBadge = {
  positive: "success",
  neutral: "info",
  concern: "warning",
} as const;

function ParentHome() {
  const [activeId, setActiveId] = useState(children[0]!.id);
  const child = useActiveChild(activeId);
  const attendance = attendanceByChild[child.id]!;
  const character = characterByChild[child.id]!;
  const recent = feedback.filter((item) => item.childId === child.id).slice(0, 2);
  const unread = updates.filter((item) => item.unread).length;

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Good morning</p>
          <h1 className="page-title mt-1 truncate">{parentName}</h1>
        </div>
        {unread > 0 ? (
          <Link to="/parent/notifications" className="shrink-0">
            <StatusBadge tone="danger">{unread} new updates</StatusBadge>
          </Link>
        ) : null}
      </header>

      <ChildSwitcher activeId={activeId} onSelect={setActiveId} />

      <section className="card-surface overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border p-5">
          <StudentAvatar name={child.name} tone={child.photoTone} className="size-14" />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-foreground">{child.name}</p>
            <p className="meta-text mt-0.5">
              Class {child.className}-{child.division} · Roll {child.rollNumber}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center sm:gap-7">
          <AttendanceRing percent={attendance.percent} />
          <div className="w-full space-y-3">
            <div>
              <p className="section-title">{attendance.verdict}</p>
              <p className="meta-text mt-1">{attendance.month} so far</p>
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
            <span className="meta-text">{character.score} points this term</span>
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
        {recent.map((item) => (
          <article key={item.id} className="card-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{item.teacher}</p>
                <p className="meta-text mt-0.5">
                  {item.subject} · {item.date}
                </p>
              </div>
              <StatusBadge tone={toneBadge[item.tone]}>
                {item.tone === "positive" ? "Praise" : item.tone === "concern" ? "Attention" : "Note"}
              </StatusBadge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">{item.message}</p>
          </article>
        ))}
        {recent.length === 0 ? (
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
