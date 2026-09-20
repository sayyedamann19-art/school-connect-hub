import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock, LogOut, MoreHorizontal, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { StudentAvatar } from "@/components/common/student-card";
import { RoleGate } from "@/components/layout/role-gate";
import { Button } from "@/components/ui/button";
import {
  getClassAttendanceSheet,
  getMyTeachingClasses,
  saveClassAttendance,
  type AttendanceStatusValue,
} from "@/lib/school.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teacher/attendance")({
  head: () => ({
    meta: [
      { title: "Mark attendance — Dawn Breakers School" },
      {
        name: "description",
        content:
          "Fast one-tap attendance marking for your assigned class roster at Dawn Breakers School, with present, absent, late, left-early and other states.",
      },
      { property: "og:title", content: "Mark attendance — Dawn Breakers School" },
      {
        property: "og:description",
        content: "One-tap attendance marking for your assigned class roster.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGate role="teacher">
      <TeacherAttendancePage />
    </RoleGate>
  ),
});

const states: {
  state: AttendanceStatusValue;
  label: string;
  icon: LucideIcon;
  active: string;
}[] = [
  { state: "present", label: "Present", icon: Check, active: "bg-teal text-teal-foreground" },
  { state: "absent", label: "Absent", icon: X, active: "bg-danger text-danger-foreground" },
  { state: "late", label: "Late", icon: Clock, active: "bg-warning text-warning-foreground" },
  { state: "left_early", label: "Left early", icon: LogOut, active: "bg-info text-info-foreground" },
  { state: "other", label: "Other", icon: MoreHorizontal, active: "bg-primary text-primary-foreground" },
];

function todayKey() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function classLabelOf(klass: { name: string; division: string | null }) {
  return klass.division ? `${klass.name}-${klass.division}` : klass.name;
}

function TeacherAttendancePage() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState<string | null>(null);
  const [date, setDate] = useState(todayKey());
  const [marks, setMarks] = useState<Record<string, AttendanceStatusValue>>({});

  const classesQuery = useQuery({
    queryKey: ["teacher", "classes"],
    queryFn: () => getMyTeachingClasses(),
  });

  const classes = classesQuery.data?.classes ?? [];
  const activeClassId = classId ?? classes[0]?.id ?? null;
  const activeClass = classes.find((row) => row.id === activeClassId) ?? null;

  const sheetQuery = useQuery({
    queryKey: ["teacher", "attendance-sheet", activeClassId, date],
    enabled: Boolean(activeClassId),
    queryFn: () => getClassAttendanceSheet({ data: { classId: activeClassId!, date } }),
  });

  const roster = sheetQuery.data?.roster ?? [];

  // Existing records for the selected date become the starting point, so saving edits them.
  useEffect(() => {
    if (!sheetQuery.data) return;
    setMarks(
      Object.fromEntries(
        sheetQuery.data.roster
          .filter((entry) => entry.status)
          .map((entry) => [entry.id, entry.status as AttendanceStatusValue]),
      ),
    );
  }, [sheetQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      saveClassAttendance({
        data: {
          classId: activeClassId!,
          date,
          marks: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })),
        },
      }),
    onSuccess: (result) => {
      toast.success("Attendance saved", {
        description: `${result.saved} students recorded for ${activeClass ? classLabelOf(activeClass) : "your class"} on ${date}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["teacher", "attendance-sheet"] });
    },
    onError: (error: Error) => {
      toast.error("Attendance not saved", {
        description: error.message || "Please try again in a moment.",
      });
    },
  });

  const marked = useMemo(() => Object.keys(marks).length, [marks]);
  const existingCount = roster.filter((entry) => entry.status).length;

  if (classesQuery.isLoading) return <LoadingCards count={3} />;
  if (classesQuery.isError) {
    return (
      <ErrorState
        title="We couldn't load your classes"
        description="Please try again in a moment."
        onRetry={() => void classesQuery.refetch()}
      />
    );
  }

  if (classes.length === 0) {
    return (
      <EmptyState
        title="No classes assigned yet"
        description="An administrator assigns classes to your account before you can record attendance."
      />
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="page-title truncate">
            {activeClass ? `Class ${classLabelOf(activeClass)}` : "Mark attendance"}
          </h1>
          <p className="meta-text mt-1.5">
            {roster.length} students
            {existingCount > 0 ? ` · ${existingCount} already recorded` : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 rounded-full"
          disabled={roster.length === 0}
          onClick={() =>
            setMarks(Object.fromEntries(roster.map((entry) => [entry.id, "present" as const])))
          }
        >
          Mark all present
        </Button>
      </header>

      <div className="card-quiet space-y-3 p-4">
        {classes.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {classes.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setClassId(row.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  row.id === activeClassId
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {classLabelOf(row)}
              </button>
            ))}
          </div>
        ) : null}
        <label className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">Attendance date</span>
          <input
            type="date"
            value={date}
            max={todayKey()}
            onChange={(event) => setDate(event.target.value || todayKey())}
            className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground"
          />
        </label>
      </div>

      <div className="card-quiet flex items-center justify-between gap-3 p-4">
        <p className="meta-text">
          {marked} of {roster.length} marked
        </p>
        <span className="h-2 w-32 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-teal transition-all"
            style={{ width: `${roster.length ? (marked / roster.length) * 100 : 0}%` }}
          />
        </span>
      </div>

      {sheetQuery.isLoading ? (
        <LoadingCards count={3} />
      ) : sheetQuery.isError ? (
        <ErrorState
          title="We couldn't load this roster"
          description="Please check the class and date, then try again."
          onRetry={() => void sheetQuery.refetch()}
        />
      ) : roster.length === 0 ? (
        <EmptyState
          title="No students in this class yet"
          description="Students appear here once they are added to the class."
        />
      ) : (
        <ul className="space-y-3">
          {roster.map((student) => (
            <li key={student.id} className="card-surface p-4">
              <div className="flex items-center gap-3">
                <StudentAvatar
                  name={student.full_name}
                  tone="navy"
                  className="size-10"
                  src={student.photoUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{student.full_name}</p>
                  <p className="meta-text mt-0.5">
                    Roll {student.roll_number ?? "—"} · GR {student.gr_number}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
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
      )}

      <div className="sticky bottom-24 lg:bottom-6">
        <Button
          className="h-12 w-full rounded-xl text-sm font-semibold shadow-[var(--shadow-float)]"
          disabled={marked === 0 || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save attendance"}
        </Button>
      </div>
    </div>
  );
}
