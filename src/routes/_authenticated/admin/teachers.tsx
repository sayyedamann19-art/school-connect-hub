import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Loader2, Plus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  adminAssignTeacher,
  adminCreateTeacher,
  adminListClasses,
  adminListTeachers,
  adminSetTeacherActive,
  adminUnassignTeacher,
  type AdminTeacher,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/teachers")({
  head: () => ({
    meta: [
      { title: "Teachers & class assignment — Dawn Breakers School Admin" },
      {
        name: "description",
        content:
          "Add teacher logins, assign them to classes and subjects, and control which classes each teacher can record attendance for.",
      },
      { property: "og:title", content: "Teachers & class assignment — Dawn Breakers School Admin" },
      {
        property: "og:description",
        content: "Add teachers and assign them to classes at Dawn Breakers School.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="admin">
      <TeachersAdmin />
    </RoleGate>
  ),
});

function TeachersAdmin() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [assigning, setAssigning] = useState<AdminTeacher | null>(null);

  const teachersQuery = useQuery({
    queryKey: ["admin", "teachers"],
    queryFn: () => adminListTeachers(),
  });
  const classesQuery = useQuery({ queryKey: ["admin", "classes"], queryFn: () => adminListClasses() });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin"] });

  const activeMutation = useMutation({
    mutationFn: (payload: { teacherId: string; isActive: boolean }) =>
      adminSetTeacherActive({ data: payload }),
    onSuccess: () => {
      toast.success("Teacher updated");
      refresh();
    },
    onError: (error) =>
      toast.error("Couldn't update the teacher", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  const unassignMutation = useMutation({
    mutationFn: (assignmentId: string) => adminUnassignTeacher({ data: { assignmentId } }),
    onSuccess: () => {
      toast.success("Class removed from this teacher");
      refresh();
    },
    onError: (error) =>
      toast.error("Couldn't remove the class", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers"
        description="A teacher can only record attendance, feedback and character points for the classes assigned here."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus className="mr-2 size-4" />
            Add teacher
          </Button>
        }
      />

      {teachersQuery.isLoading ? (
        <LoadingCards count={3} />
      ) : teachersQuery.isError ? (
        <ErrorState
          title="We couldn't load teachers"
          description="Please try again in a moment."
          onRetry={() => void teachersQuery.refetch()}
        />
      ) : (teachersQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="No teachers yet"
          description="Add a teacher login to start assigning classes."
          icon={<GraduationCap className="size-5" strokeWidth={1.75} />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(teachersQuery.data ?? []).map((teacher) => (
            <SectionCard
              key={teacher.id}
              title={teacher.name}
              description={[teacher.employee_code ?? "No employee code", teacher.phone ?? null]
                .filter(Boolean)
                .join(" · ")}
              action={
                <div className="flex items-center gap-2">
                  <span className="meta-text">{teacher.is_active ? "Active" : "Inactive"}</span>
                  <Switch
                    checked={teacher.is_active}
                    onCheckedChange={(checked) =>
                      activeMutation.mutate({ teacherId: teacher.id, isActive: checked })
                    }
                  />
                </div>
              }
            >
              <div className="space-y-3">
                {teacher.classes.length === 0 ? (
                  <p className="meta-text">No classes assigned yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {teacher.classes.map((assignment) => (
                      <Badge key={assignment.assignmentId} variant="outline" className="gap-1.5">
                        {assignment.label}
                        {assignment.subject ? ` · ${assignment.subject}` : ""}
                        {assignment.isClassTeacher ? " · class teacher" : ""}
                        <button
                          type="button"
                          aria-label={`Remove ${assignment.label}`}
                          onClick={() => unassignMutation.mutate(assignment.assignmentId)}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => setAssigning(teacher)}>
                  <Plus className="mr-2 size-4" />
                  Assign class
                </Button>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <AddTeacherDialog open={adding} onClose={() => setAdding(false)} />
      <AssignClassDialog
        teacher={assigning}
        classes={(classesQuery.data ?? []).map((row) => ({
          id: row.id,
          label: `${row.name}${row.division ? `-${row.division}` : ""} · ${row.academic_year}`,
        }))}
        onClose={() => setAssigning(null)}
      />
    </div>
  );
}

function AddTeacherDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    employeeCode: "",
    phone: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      adminCreateTeacher({
        data: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          ...(form.employeeCode.trim() ? { employeeCode: form.employeeCode.trim() } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Teacher added", { description: "Share the email and password with them." });
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      setForm({ fullName: "", email: "", password: "", employeeCode: "", phone: "" });
      onClose();
    },
    onError: (error) =>
      toast.error("Couldn't add the teacher", {
        description: error instanceof Error ? error.message : "Please check the details.",
      }),
  });

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add teacher</DialogTitle>
          <DialogDescription>
            This creates a staff login. The teacher can change the password after signing in.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {(
            [
              { key: "fullName", label: "Full name", placeholder: "Priya Nair" },
              { key: "email", label: "Work email", placeholder: "name@dawnbreakers.edu" },
              { key: "password", label: "Temporary password", placeholder: "At least 8 characters" },
              { key: "employeeCode", label: "Employee code (optional)", placeholder: "T003" },
              { key: "phone", label: "Phone (optional)", placeholder: "9820011223" },
            ] as const
          ).map((field) => (
            <div key={field.key} className="space-y-2">
              <Label>{field.label}</Label>
              <Input
                type={field.key === "password" ? "text" : "text"}
                placeholder={field.placeholder}
                value={form[field.key]}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Add teacher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignClassDialog({
  teacher,
  classes,
  onClose,
}: {
  teacher: AdminTeacher | null;
  classes: { id: string; label: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      adminAssignTeacher({
        data: {
          teacherId: teacher!.id,
          classId,
          ...(subject.trim() ? { subject: subject.trim() } : {}),
          isClassTeacher,
        },
      }),
    onSuccess: () => {
      toast.success("Class assigned");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      setClassId("");
      setSubject("");
      setIsClassTeacher(false);
      onClose();
    },
    onError: (error) =>
      toast.error("Couldn't assign the class", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  if (!teacher) return null;

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign a class</DialogTitle>
          <DialogDescription>{teacher.name} will be able to record for this class.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject (optional)</Label>
            <Input
              placeholder="Mathematics"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Class teacher</Label>
            <Switch checked={isClassTeacher} onCheckedChange={setIsClassTeacher} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending || !classId} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
