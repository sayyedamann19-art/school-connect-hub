import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, School } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { RoleGate } from "@/components/layout/role-gate";
import { Badge } from "@/components/ui/badge";
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

function ClassesAdmin() {
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; row: AdminClass } | null>(
    null,
  );

  const classesQuery = useQuery({ queryKey: ["admin", "classes"], queryFn: () => adminListClasses() });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes & divisions"
        description="Classes drive teacher assignment, attendance and the class shown on every student record."
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
        <div className="grid gap-4 md:grid-cols-2">
          {(classesQuery.data ?? []).map((row) => (
            <SectionCard
              key={row.id}
              title={`${row.name}${row.division ? `-${row.division}` : ""}`}
              description={`${row.academic_year} · ${row.studentCount} student${row.studentCount === 1 ? "" : "s"}`}
              action={
                <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: "edit", row })}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Button>
              }
            >
              {row.teachers.length === 0 ? (
                <p className="meta-text">No teacher assigned yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {row.teachers.map((teacher) => (
                    <Badge key={teacher.assignmentId} variant="outline">
                      {teacher.name}
                      {teacher.subject ? ` · ${teacher.subject}` : ""}
                      {teacher.isClassTeacher ? " · class teacher" : ""}
                    </Badge>
                  ))}
                </div>
              )}
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
