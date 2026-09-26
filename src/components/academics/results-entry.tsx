import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getExamSheet,
  listAcademicClasses,
  listAcademicSetup,
  saveExamResults,
  type ResultStatus,
} from "@/lib/academics.functions";
import { cn } from "@/lib/utils";

type Cell = { status: ResultStatus; marks: string; max: string; saved: boolean };

const statusShort: Record<ResultStatus, string> = { present: "P", absent: "AB", not_applicable: "NA" };
const statusLabel: Record<ResultStatus, string> = {
  present: "Present",
  absent: "Absent",
  not_applicable: "Not applicable",
};

function classLabel(klass: { name: string; division: string | null }) {
  return klass.division ? `${klass.name}-${klass.division}` : klass.name;
}

/** Marks entry grid shared by teachers (assigned classes only) and admins. */
export function ResultsEntry() {
  const queryClient = useQueryClient();
  const setupQuery = useQuery({ queryKey: ["academics", "setup"], queryFn: () => listAcademicSetup() });
  const classesQuery = useQuery({ queryKey: ["academics", "classes"], queryFn: () => listAcademicClasses() });

  const exams = (setupQuery.data?.exams ?? []).filter((e) => e.is_active);
  const subjects = (setupQuery.data?.subjects ?? []).filter((s) => s.is_active);
  const years = Array.from(new Set(exams.map((e) => e.academic_year)));

  const [year, setYear] = useState<string | null>(null);
  const [examId, setExamId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [defaultMax, setDefaultMax] = useState("100");
  const [cells, setCells] = useState<Record<string, Cell>>({});

  const activeYear = year ?? years[0] ?? null;
  const yearExams = exams.filter((e) => e.academic_year === activeYear);
  const exam = yearExams.find((e) => e.id === examId) ?? yearExams[0] ?? null;
  const yearClasses = (classesQuery.data?.classes ?? []).filter((c) => c.academic_year === activeYear);
  const klass = yearClasses.find((c) => c.id === classId) ?? yearClasses[0] ?? null;
  const isAdmin = classesQuery.data?.isAdmin ?? false;
  const locked = exam?.status === "published" && !isAdmin;

  const sheetQuery = useQuery({
    queryKey: ["academics", "sheet", exam?.id, klass?.id],
    enabled: Boolean(exam && klass),
    queryFn: () => getExamSheet({ data: { examId: exam!.id, classId: klass!.id } }),
  });

  useEffect(() => {
    if (!sheetQuery.data) return;
    const next: Record<string, Cell> = {};
    for (const r of sheetQuery.data.results) {
      next[`${r.student_id}:${r.subject_id}`] = {
        status: r.status,
        marks: r.marks_obtained === null ? "" : String(r.marks_obtained),
        max: String(r.maximum_marks),
        saved: true,
      };
    }
    setCells(next);
  }, [sheetQuery.data]);

  const students = sheetQuery.data?.students ?? [];

  const cellOf = (key: string): Cell =>
    cells[key] ?? { status: "present", marks: "", max: defaultMax, saved: false };

  function update(key: string, patch: Partial<Cell>) {
    setCells((prev) => ({ ...prev, [key]: { ...cellOf(key), ...patch } }));
  }

  const problems = useMemo(() => {
    const list: string[] = [];
    for (const [key, cell] of Object.entries(cells)) {
      const max = Number(cell.max);
      if (!(max > 0)) list.push(key);
      else if (cell.status === "present" && cell.marks !== "") {
        const marks = Number(cell.marks);
        if (Number.isNaN(marks) || marks < 0 || marks > max) list.push(key);
      }
    }
    return new Set(list);
  }, [cells]);

  const save = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(cells).flatMap(([key, cell]) => {
        const [studentId, subjectId] = key.split(":");
        const empty = cell.status === "present" && cell.marks.trim() === "";
        if (empty && !cell.saved) return [];
        return [
          {
            studentId,
            subjectId,
            status: cell.status,
            marks: cell.status === "present" && !empty ? Number(cell.marks) : null,
            maxMarks: Number(cell.max),
            clear: empty,
          },
        ];
      });
      if (entries.length === 0) throw new Error("Enter at least one mark first");
      return saveExamResults({ data: { examId: exam!.id, classId: klass!.id, entries } });
    },
    onSuccess: (res) => {
      toast.success("Results saved", {
        description: `${res.saved} subject result${res.saved === 1 ? "" : "s"} saved${res.cleared ? `, ${res.cleared} cleared` : ""}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["academics", "sheet"] });
      void queryClient.invalidateQueries({ queryKey: ["parent"] });
    },
    onError: (error: Error) => toast.error("Results not saved", { description: error.message }),
  });

  if (setupQuery.isLoading || classesQuery.isLoading) return <LoadingCards count={2} />;
  if (setupQuery.isError || classesQuery.isError)
    return (
      <ErrorState
        title="We couldn't load exams"
        description="Please try again in a moment."
        onRetry={() => {
          void setupQuery.refetch();
          void classesQuery.refetch();
        }}
      />
    );
  if (exams.length === 0)
    return <EmptyState title="No exams set up" description="An administrator needs to add exams first." />;
  if (subjects.length === 0)
    return <EmptyState title="No subjects set up" description="An administrator needs to add subjects first." />;

  return (
    <div className="space-y-5">
      <section className="card-surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Academic year</Label>
          <Select value={activeYear ?? undefined} onValueChange={(v) => { setYear(v); setExamId(null); setClassId(null); }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Exam</Label>
          <Select value={exam?.id} onValueChange={setExamId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select exam" /></SelectTrigger>
            <SelectContent>
              {yearExams.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Class / division</Label>
          <Select value={klass?.id} onValueChange={setClassId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {yearClasses.map((c) => <SelectItem key={c.id} value={c.id}>{classLabel(c)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="default-max">Default max marks</Label>
          <Input id="default-max" type="number" min={1} max={1000} inputMode="numeric" value={defaultMax} onChange={(e) => setDefaultMax(e.target.value)} />
        </div>
      </section>

      {exam ? (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={exam.status === "published" ? "success" : "warning"}>
            {exam.status === "published" ? "Published" : "Draft"}
          </StatusBadge>
          <p className="meta-text">
            {locked
              ? "Published results are locked. Ask an administrator to unpublish to correct them."
              : "Parents see these results only after an administrator publishes the exam."}
          </p>
        </div>
      ) : null}

      {!klass ? (
        <EmptyState title="No classes for this year" description="Only your assigned classes appear here." />
      ) : sheetQuery.isLoading ? (
        <LoadingCards count={2} />
      ) : sheetQuery.isError ? (
        <ErrorState title="We couldn't load students" description={(sheetQuery.error as Error).message} onRetry={() => void sheetQuery.refetch()} />
      ) : students.length === 0 ? (
        <EmptyState title="No active students in this class" />
      ) : (
        <>
          <ul className="space-y-3">
            {students.map((student) => (
              <li key={student.id} className="card-surface p-4">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-bold text-foreground">{student.full_name}</p>
                  <p className="meta-text shrink-0">
                    {student.roll_number ? `Roll ${student.roll_number} · ` : ""}GR {student.gr_number}
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {subjects.map((subject) => {
                    const key = `${student.id}:${subject.id}`;
                    const cell = cellOf(key);
                    const bad = problems.has(key);
                    return (
                      <div key={subject.id} className="flex flex-wrap items-center gap-2 py-2">
                        <span className="min-w-28 flex-1 text-sm text-foreground">{subject.name}</span>
                        <div className="flex rounded-lg border border-border p-0.5">
                          {(Object.keys(statusShort) as ResultStatus[]).map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={locked}
                              title={statusLabel[s]}
                              onClick={() => update(key, { status: s, marks: s === "present" ? cell.marks : "" })}
                              className={cn(
                                "rounded-md px-2 py-1 text-xs font-bold",
                                cell.status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                              )}
                            >
                              {statusShort[s]}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            aria-label={`${subject.name} marks for ${student.full_name}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            disabled={locked || cell.status !== "present"}
                            value={cell.marks}
                            onChange={(e) => update(key, { marks: e.target.value })}
                            className={cn("h-9 w-16 px-2 text-center", bad && "border-danger")}
                          />
                          <span className="text-muted-foreground">/</span>
                          <Input
                            aria-label={`${subject.name} maximum marks`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            disabled={locked}
                            value={cell.max}
                            onChange={(e) => update(key, { max: e.target.value })}
                            className={cn("h-9 w-16 px-2 text-center", bad && "border-danger")}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

          <div className="sticky bottom-20 z-10 md:bottom-4">
            <Button
              className="w-full"
              size="lg"
              disabled={locked || save.isPending || problems.size > 0}
              onClick={() => save.mutate()}
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : locked ? <Lock className="size-4" /> : <Save className="size-4" />}
              {problems.size > 0 ? "Fix highlighted marks" : "Save draft"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
