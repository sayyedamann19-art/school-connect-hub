import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Award, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { StudentAvatar } from "@/components/common/student-card";
import { RoleGate } from "@/components/layout/role-gate";
import { Button } from "@/components/ui/button";
import {
  deleteCharacterPoint,
  getClassStudents,
  getMyTeachingClasses,
  getStudentCharacterPoints,
  saveCharacterPoint,
  updateCharacterPoint,
} from "@/lib/school.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teacher/character")({
  head: () => ({
    meta: [
      { title: "Character points — Dawn Breakers School" },
      {
        name: "description",
        content:
          "Award positive and negative character points to students in your assigned classes at Dawn Breakers School, in line with Morality Before Materiality.",
      },
      { property: "og:title", content: "Character points — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Award character points with a reason and date for students you teach.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGate role="teacher">
      <TeacherCharacterPage />
    </RoleGate>
  ),
});

function todayKey() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function classLabelOf(klass: { name: string; division: string | null }) {
  return klass.division ? `${klass.name}-${klass.division}` : klass.name;
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function TeacherCharacterPage() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"positive" | "negative">("positive");
  const [value, setValue] = useState(1);
  const [reason, setReason] = useState("");
  const [awardedOn, setAwardedOn] = useState(todayKey());
  const [editingId, setEditingId] = useState<string | null>(null);

  const classesQuery = useQuery({
    queryKey: ["teacher", "classes"],
    queryFn: () => getMyTeachingClasses(),
  });

  const classes = classesQuery.data?.classes ?? [];
  const activeClassId = classId ?? classes[0]?.id ?? null;
  const activeClass = classes.find((row) => row.id === activeClassId) ?? null;

  const studentsQuery = useQuery({
    queryKey: ["teacher", "class-students", activeClassId],
    enabled: Boolean(activeClassId),
    queryFn: () => getClassStudents({ data: { classId: activeClassId! } }),
  });

  const students = studentsQuery.data?.students ?? [];
  const activeStudentId = studentId ?? students[0]?.id ?? null;
  const activeStudent = students.find((row) => row.id === activeStudentId) ?? null;

  const pointsQuery = useQuery({
    queryKey: ["teacher", "character-points", activeStudentId],
    enabled: Boolean(activeStudentId),
    queryFn: () => getStudentCharacterPoints({ data: { studentId: activeStudentId! } }),
  });

  const entries = pointsQuery.data?.entries ?? [];
  const score = entries.reduce((sum, entry) => sum + entry.points, 0);
  const positive = entries
    .filter((entry) => entry.points > 0)
    .reduce((sum, entry) => sum + entry.points, 0);
  const negative = entries
    .filter((entry) => entry.points < 0)
    .reduce((sum, entry) => sum + Math.abs(entry.points), 0);

  function resetForm() {
    setEditingId(null);
    setDirection("positive");
    setValue(1);
    setReason("");
    setAwardedOn(todayKey());
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["teacher", "character-points"] });
    void queryClient.invalidateQueries({ queryKey: ["parent"] });
  }

  const signedPoints = direction === "positive" ? Math.abs(value) : -Math.abs(value);

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return updateCharacterPoint({
          data: { id: editingId, points: signedPoints, reason: reason.trim(), awardedOn },
        });
      }
      return saveCharacterPoint({
        data: {
          studentId: activeStudentId!,
          points: signedPoints,
          reason: reason.trim(),
          awardedOn,
        },
      });
    },
    onSuccess: () => {
      toast.success(editingId ? "Entry updated" : "Points recorded", {
        description: activeStudent ? `Saved for ${activeStudent.full_name}.` : "Saved successfully.",
      });
      resetForm();
      refresh();
    },
    onError: (error: Error) => {
      toast.error("Points not saved", {
        description: error.message || "Please try again in a moment.",
      });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCharacterPoint({ data: { id } }),
    onSuccess: () => {
      toast.success("Entry removed");
      resetForm();
      refresh();
    },
    onError: (error: Error) => {
      toast.error("Could not remove entry", {
        description: error.message || "Please try again in a moment.",
      });
    },
  });

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
        description="An administrator assigns classes to your account before you can award character points."
      />
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <header>
        <h1 className="page-title">Character points</h1>
        <p className="meta-text mt-1.5">
          {activeClass ? `Class ${classLabelOf(activeClass)}` : "Your classes"} · Morality Before
          Materiality
        </p>
      </header>

      <div className="card-quiet space-y-3 p-4">
        {classes.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {classes.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setClassId(row.id);
                  setStudentId(null);
                  resetForm();
                }}
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

        {studentsQuery.isLoading ? (
          <p className="meta-text">Loading students…</p>
        ) : students.length === 0 ? (
          <p className="meta-text">No students in this class yet.</p>
        ) : (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {students.map((student) => {
              const active = student.id === activeStudentId;
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => {
                    setStudentId(student.id);
                    resetForm();
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "border-primary/20 bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  <StudentAvatar
                    name={student.full_name}
                    src={student.photoUrl}
                    tone="teal"
                    className="size-7 border-0"
                  />
                  {student.full_name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activeStudent ? (
        <>
          <section className="card-surface overflow-hidden bg-primary p-5 text-primary-foreground">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gold">
              {activeStudent.full_name} · Current score
            </p>
            <p className="metric-number mt-2">{score}</p>
            <div className="mt-4 flex gap-2.5">
              <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-3 py-1 text-xs font-semibold">
                <Plus className="size-3.5" strokeWidth={2.25} />
                {positive} earned
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-3 py-1 text-xs font-semibold">
                <Minus className="size-3.5" strokeWidth={2.25} />
                {negative} deducted
              </span>
            </div>
          </section>

          <section className="card-surface space-y-3 p-4">
            <div className="flex gap-2">
              {(["positive", "negative"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDirection(option)}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                    direction === option
                      ? option === "positive"
                        ? "border-transparent bg-teal text-primary-foreground"
                        : "border-transparent bg-danger text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option === "positive" ? "Earned" : "Deducted"}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="eyebrow">Points</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={value}
                  onChange={(event) =>
                    setValue(Math.min(Math.max(Number(event.target.value) || 1, 1), 50))
                  }
                  className="h-10 w-20 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="eyebrow">Date</span>
                <input
                  type="date"
                  value={awardedOn}
                  max={todayKey()}
                  onChange={(event) => setAwardedOn(event.target.value || todayKey())}
                  className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground"
                />
              </label>
            </div>

            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Reason — what the student did…"
              className="w-full rounded-xl border border-border bg-surface p-3 text-sm text-foreground outline-none focus:border-primary/40"
            />

            <div className="flex gap-2">
              <Button
                className="h-11 flex-1 rounded-xl text-sm font-semibold"
                disabled={reason.trim().length < 3 || save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending
                  ? "Saving…"
                  : editingId
                    ? "Update entry"
                    : `Save ${direction === "positive" ? "+" : "−"}${Math.abs(value)}`}
              </Button>
              {editingId ? (
                <Button variant="outline" className="h-11 rounded-xl" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="eyebrow">Point history</h2>
            {pointsQuery.isLoading ? (
              <LoadingCards count={2} />
            ) : pointsQuery.isError ? (
              <ErrorState
                title="We couldn't load the point history"
                onRetry={() => void pointsQuery.refetch()}
              />
            ) : entries.length === 0 ? (
              <EmptyState
                title="No character points yet"
                description="Your first entry for this student will appear here."
                icon={<Award className="size-5" strokeWidth={1.75} />}
              />
            ) : (
              <ol className="space-y-3">
                {entries.map((entry) => (
                  <li key={entry.id} className="card-surface flex gap-3.5 p-4">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
                        entry.points >= 0 ? "bg-teal-soft text-teal" : "bg-danger-soft text-danger",
                      )}
                    >
                      {entry.points > 0 ? `+${entry.points}` : entry.points}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <StatusBadge tone={entry.points >= 0 ? "success" : "danger"}>
                            {entry.points >= 0 ? "Earned" : "Deducted"}
                          </StatusBadge>
                          <p className="meta-text mt-1.5">
                            {entry.teacher_name} · {formatDate(entry.awarded_on)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit entry"
                            onClick={() => {
                              setEditingId(entry.id);
                              setDirection(entry.points >= 0 ? "positive" : "negative");
                              setValue(Math.abs(entry.points) || 1);
                              setReason(entry.reason ?? "");
                              setAwardedOn(entry.awarded_on);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete entry"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(entry.id)}
                          >
                            <Trash2 className="size-4 text-danger" />
                          </Button>
                        </div>
                      </div>
                      {entry.reason ? (
                        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                          {entry.reason}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
