import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareText, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { StudentAvatar } from "@/components/common/student-card";
import { RoleGate } from "@/components/layout/role-gate";
import { Button } from "@/components/ui/button";
import {
  deleteTeacherNote,
  getClassStudents,
  getMyTeachingClasses,
  getStudentNotes,
  saveTeacherNote,
  updateTeacherNote,
} from "@/lib/school.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teacher/feedback")({
  head: () => ({
    meta: [
      { title: "Share feedback — Dawn Breakers School" },
      {
        name: "description",
        content:
          "Write and manage feedback notes for students in your assigned classes at Dawn Breakers School, visible to their parents.",
      },
      { property: "og:title", content: "Share feedback — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Write feedback notes for students in your assigned classes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGate role="teacher">
      <TeacherFeedbackPage />
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

function TeacherFeedbackPage() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("");
  const [noteDate, setNoteDate] = useState(todayKey());
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

  const notesQuery = useQuery({
    queryKey: ["teacher", "student-notes", activeStudentId],
    enabled: Boolean(activeStudentId),
    queryFn: () => getStudentNotes({ data: { studentId: activeStudentId! } }),
  });

  const notes = notesQuery.data?.notes ?? [];

  function resetForm() {
    setEditingId(null);
    setNote("");
    setSubject("");
    setNoteDate(todayKey());
  }

  function refreshNotes() {
    void queryClient.invalidateQueries({ queryKey: ["teacher", "student-notes"] });
    void queryClient.invalidateQueries({ queryKey: ["parent"] });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return updateTeacherNote({
          data: { id: editingId, note: note.trim(), noteDate, subject: subject.trim() },
        });
      }
      return saveTeacherNote({
        data: {
          studentId: activeStudentId!,
          note: note.trim(),
          noteDate,
          subject: subject.trim(),
          ...(activeClassId ? { classId: activeClassId } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success(editingId ? "Feedback updated" : "Feedback shared", {
        description: activeStudent
          ? `Saved for ${activeStudent.full_name}.`
          : "Saved successfully.",
      });
      resetForm();
      refreshNotes();
    },
    onError: (error: Error) => {
      toast.error("Feedback not saved", {
        description: error.message || "Please try again in a moment.",
      });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTeacherNote({ data: { id } }),
    onSuccess: () => {
      toast.success("Feedback removed");
      resetForm();
      refreshNotes();
    },
    onError: (error: Error) => {
      toast.error("Could not remove feedback", {
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
        description="An administrator assigns classes to your account before you can share feedback."
      />
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <header>
        <h1 className="page-title">Share feedback</h1>
        <p className="meta-text mt-1.5">
          {activeClass ? `Class ${classLabelOf(activeClass)}` : "Your classes"} · notes are visible
          to the student's parents
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
          <section className="card-surface space-y-3 p-4">
            <div className="flex items-center gap-3">
              <StudentAvatar
                name={activeStudent.full_name}
                src={activeStudent.photoUrl}
                tone="navy"
                className="size-10"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">
                  {activeStudent.full_name}
                </p>
                <p className="meta-text mt-0.5">
                  Roll {activeStudent.roll_number ?? "—"} · GR {activeStudent.gr_number}
                </p>
              </div>
            </div>

            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Write feedback about classwork, effort or behaviour…"
              className="w-full rounded-xl border border-border bg-surface p-3 text-sm text-foreground outline-none focus:border-primary/40"
            />

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="eyebrow">Subject</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={60}
                  placeholder="Optional"
                  className="h-10 w-36 rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="eyebrow">Date</span>
                <input
                  type="date"
                  value={noteDate}
                  max={todayKey()}
                  onChange={(event) => setNoteDate(event.target.value || todayKey())}
                  className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground"
                />
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                className="h-11 flex-1 rounded-xl text-sm font-semibold"
                disabled={note.trim().length < 3 || save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Saving…" : editingId ? "Update feedback" : "Save feedback"}
              </Button>
              {editingId ? (
                <Button variant="outline" className="h-11 rounded-xl" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="eyebrow">Previous feedback</h2>
            {notesQuery.isLoading ? (
              <LoadingCards count={2} />
            ) : notesQuery.isError ? (
              <ErrorState
                title="We couldn't load previous feedback"
                onRetry={() => void notesQuery.refetch()}
              />
            ) : notes.length === 0 ? (
              <EmptyState
                title="No feedback yet"
                description="Your first note for this student will appear here."
                icon={<MessageSquareText className="size-5" strokeWidth={1.75} />}
              />
            ) : (
              <ol className="space-y-3">
                {notes.map((item) => (
                  <li key={item.id} className="card-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">
                          {item.teacher_name}
                        </p>
                        <p className="meta-text mt-0.5">
                          {formatDate(item.note_date)}
                          {item.subject ? ` · ${item.subject}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit feedback"
                          onClick={() => {
                            setEditingId(item.id);
                            setNote(item.note);
                            setSubject(item.subject ?? "");
                            setNoteDate(item.note_date);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete feedback"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(item.id)}
                        >
                          <Trash2 className="size-4 text-danger" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-foreground/90">{item.note}</p>
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
