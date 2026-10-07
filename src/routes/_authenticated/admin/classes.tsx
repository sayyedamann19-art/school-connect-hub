import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Loader2, Pencil, Plus, School } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { RoleGate } from "@/components/layout/role-gate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCreateClass, adminListClasses, adminUpdateClass, type AdminClass } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/classes")({
  head: () => ({
    meta: [
      { title: "Classes & divisions — Dawn Breakers School Admin" },
      {
        name: "description",
        content:
          "Create and edit classes and divisions per academic year, and see how many students and teachers each class has.",
      },
      { property: "og:title", content: "Classes & divisions — Dawn Breakers School Admin" },
      {
        property: "og:description",
        content: "Create classes and divisions for the academic year at Dawn Breakers School.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="admin">
      <ClassesAdmin />
    </RoleGate>
  ),
});

function defaultAcademicYear() {
  const now = new Date();
  const start = now.getMonth() + 1 >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function groupByClass(rows: AdminClass[]) {
  const groups = new Map<
    string,
    { key: string; name: string; year: string; students: number; divisions: AdminClass[] }
  >();
  for (const row of rows) {
    const key = `${row.academic_year}::${row.name}`;
    const group = groups.get(key) ?? { key, name: row.name, year: row.academic_year, students: 0, divisions: [] };
    group.divisions.push(row);
    group.students += row.studentCount;
    groups.set(key, group);
  }
  return [...groups.values()];
}

function ClassesAdmin() {
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; row: AdminClass } | null>(
    null,
  );

  const classesQuery = useQuery({ queryKey: ["admin", "classes"], queryFn: () => adminListClasses() });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes & divisions"
        description="Open a division to see and manage its students."
        action={
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="mr-2 size-4" />
            New class
          </Button>
        }
      />

      {classesQuery.isLoading ? (
        <LoadingCards count={3} />
      ) : classesQuery.isError ? (
        <ErrorState
          title="We couldn't load classes"
          description="Please try again in a moment."
          onRetry={() => void classesQuery.refetch()}
        />
      ) : (classesQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Create your first class to start assigning teachers and students."
          icon={<School className="size-5" strokeWidth={1.75} />}
        />
      ) : (
        <div className="space-y-4">
          {groupByClass(classesQuery.data ?? []).map((group) => (
            <SectionCard
              key={group.key}
              title={group.name}
              description={`${group.year} · ${group.divisions.length} division${group.divisions.length === 1 ? "" : "s"} · ${group.students} student${group.students === 1 ? "" : "s"}`}
              contentClassName="p-0"
            >
              <ul className="divide-y divide-border">
                {group.divisions.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link
                      to="/admin/students"
                      search={{ classId: row.id }}
                      className="group flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-bold text-primary">
                        {row.division || "—"}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground group-hover:underline">
                          {row.division ? `Division ${row.division}` : "No division"}
                          <span className="font-normal text-muted-foreground">
                            {" · "}
                            {row.studentCount} student{row.studentCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="meta-text block truncate">
                          {row.teachers.length === 0
                            ? "No teacher assigned yet"
                            : row.teachers
                                .map(
                                  (t) =>
                                    `${t.name}${t.subject ? ` (${t.subject})` : ""}${t.isClassTeacher ? " · class teacher" : ""}`,
                                )
                                .join(", ")}
                        </span>
                      </span>
                      <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start sm:self-auto"
                      onClick={() => setDialog({ mode: "edit", row })}
                    >
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ))}
        </div>
      )}

      <ClassDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function ClassDialog({
  dialog,
  onClose,
}: {
  dialog: { mode: "create" } | { mode: "edit"; row: AdminClass } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const existing = dialog && dialog.mode === "edit" ? dialog.row : null;
  const [name, setName] = useState("");
  const [division, setDivision] = useState("");
  const [year, setYear] = useState("");

  const mutation = useMutation({
    mutationFn: async (payload: { name: string; division: string | null; academicYear: string }) =>
      existing
        ? adminUpdateClass({ data: { ...payload, classId: existing.id } })
        : adminCreateClass({ data: payload }),
    onSuccess: () => {
      toast.success(existing ? "Class updated" : "Class created");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
      onClose();
      setName("");
      setDivision("");
      setYear("");
    },
    onError: (error) => {
      toast.error("Couldn't save the class", {
        description: error instanceof Error ? error.message : "Please check the values.",
      });
    },
  });

  if (!dialog) return null;

  const nameValue = name || existing?.name || "";
  const divisionValue = division || existing?.division || "";
  const yearValue = year || existing?.academic_year || defaultAcademicYear();

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit class" : "New class"}</DialogTitle>
          <DialogDescription>
            A class is identified by its name, division and academic year.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Class name</Label>
            <Input
              placeholder="Grade 5"
              value={nameValue}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Division (optional)</Label>
            <Input
              placeholder="A"
              value={divisionValue}
              onChange={(event) => setDivision(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Academic year</Label>
            <Input
              placeholder="2026-2027"
              value={yearValue}
              onChange={(event) => setYear(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                name: nameValue.trim(),
                division: divisionValue.trim() ? divisionValue.trim() : null,
                academicYear: yearValue.trim(),
              })
            }
          >
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {existing ? "Save changes" : "Create class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
