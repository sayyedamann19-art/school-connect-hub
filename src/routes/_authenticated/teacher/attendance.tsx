import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock, LogOut, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StudentAvatar } from "@/components/common/student-card";
import { Button } from "@/components/ui/button";
import { roster, teacherClass, type AttendanceState } from "@/lib/mock/school-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teacher/attendance")({
  head: () => ({
    meta: [
      { title: "Mark attendance — Dawn Breakers School" },
      {
        name: "description",
        content:
          "Fast one-tap attendance marking for your class roster at Dawn Breakers School, with present, absent, late and left-early states.",
      },
      { property: "og:title", content: "Mark attendance — Dawn Breakers School" },
      {
        property: "og:description",
        content: "One-tap attendance marking for your class roster.",
      },
    ],
  }),
  component: TeacherAttendancePage,
});

const states: { state: AttendanceState; label: string; icon: LucideIcon; active: string }[] = [
  { state: "present", label: "Present", icon: Check, active: "bg-teal text-teal-foreground" },
  { state: "absent", label: "Absent", icon: X, active: "bg-danger text-danger-foreground" },
  { state: "late", label: "Late", icon: Clock, active: "bg-warning text-warning-foreground" },
  { state: "left_early", label: "Left early", icon: LogOut, active: "bg-info text-info-foreground" },
];

function TeacherAttendancePage() {
  const [marks, setMarks] = useState<Record<string, AttendanceState>>({});
  const marked = Object.keys(marks).length;

  function markAll() {
    setMarks(Object.fromEntries(roster.map((student) => [student.id, "present" as AttendanceState])));
  }

  return (
    <div className="space-y-5 pb-4">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="page-title truncate">Class {teacherClass.label}</h1>
          <p className="meta-text mt-1.5">
            {teacherClass.date} · {teacherClass.strength} students
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={markAll}>
          Mark all present
        </Button>
      </header>

      <div className="card-quiet flex items-center justify-between gap-3 p-4">
        <p className="meta-text">
          {marked} of {roster.length} marked
        </p>
        <span className="h-2 w-32 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-teal transition-all"
            style={{ width: `${(marked / roster.length) * 100}%` }}
          />
        </span>
      </div>

      <ul className="space-y-3">
        {roster.map((student) => (
          <li key={student.id} className="card-surface p-4">
            <div className="flex items-center gap-3">
              <StudentAvatar name={student.name} tone="navy" className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{student.name}</p>
                <p className="meta-text mt-0.5">Roll {student.rollNumber}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {states.map((option) => {
                const active = marks[student.id] === option.state;
                return (
                  <button
                    key={option.state}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setMarks((current) => ({ ...current, [student.id]: option.state }))
                    }
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border py-2 text-[0.6875rem] font-semibold transition-colors",
                      active
                        ? cn("border-transparent", option.active)
                        : "border-border bg-surface text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <option.icon className="size-4" strokeWidth={2} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-24 lg:bottom-6">
        <Button
          className="h-12 w-full rounded-xl text-sm font-semibold shadow-[var(--shadow-float)]"
          disabled={marked === 0}
          onClick={() =>
            toast.success("Attendance saved", {
              description: `${marked} students marked for ${teacherClass.label}.`,
            })
          }
        >
          Save attendance
        </Button>
      </div>
    </div>
  );
}
