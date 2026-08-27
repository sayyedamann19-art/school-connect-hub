import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Pencil, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { ErrorState, LoadingCards } from "@/components/common/states";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listClasses, listManagedStudents, updateStudent } from "@/lib/students.functions";

export const Route = createFileRoute("/_authenticated/admin/students")({
  head: () => ({
    meta: [
      { title: "Student records — School Connect Admin" },
      {
        name: "description",
        content:
          "Search, review and edit student records: GR number, class, roll number, height, weight and parent contact details.",
      },
      { property: "og:title", content: "Student records — School Connect Admin" },
      {
        property: "og:description",
        content: "Search and edit student records, class assignment and parent contact details.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="admin">
      <StudentsAdmin />
    </RoleGate>
  ),
});

type Student = Awaited<ReturnType<typeof listManagedStudents>>[number];

function StudentsAdmin() {
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState<string>("all");
  const [editing, setEditing] = useState<Student | null>(null);

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => listClasses() });
  const studentsQuery = useQuery({
    queryKey: ["students", "managed", search, classId],
    queryFn: () =>
      listManagedStudents({
        data: {
          ...(search ? { search } : {}),
          ...(classId !== "all" ? { classId } : {}),
        },
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student records"
        description="Manual edits and Excel imports update the same student records parents see."
        action={
          <Button asChild variant="outline">
            <Link to="/admin/import">
              <Upload className="mr-2 size-4" />
              Import from Excel
            </Link>
          </Button>
        }
      />

      <SectionCard title="Find a student">
        <div className="flex flex-wrap gap-3">
          <Input
            className="max-w-xs"
            placeholder="Search name, GR number or roll number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {(classesQuery.data ?? []).map((schoolClass) => (
                <SelectItem key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                  {schoolClass.division ? ` ${schoolClass.division}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {studentsQuery.isLoading ? (
        <LoadingCards count={2} />
      ) : studentsQuery.isError ? (
        <ErrorState
          title="We couldn't load student records"
          description="Please try again in a moment."
          onRetry={() => void studentsQuery.refetch()}
        />
      ) : (
        <SectionCard
          title={`${studentsQuery.data?.length ?? 0} students`}
          description="Click edit to change a record."
          contentClassName="px-0 py-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GR Number</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead>Height / Weight</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(studentsQuery.data ?? []).map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.gr_number}</TableCell>
                    <TableCell>
                      {student.full_name}
                      {student.is_active ? null : (
                        <Badge variant="outline" className="ml-2">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {student.class
                        ? `${student.class.name}${student.class.division ? ` ${student.class.division}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>{student.roll_number ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.height_cm ? `${student.height_cm} cm` : "—"} /{" "}
                      {student.weight_kg ? `${student.weight_kg} kg` : "—"}
                    </TableCell>
                    <TableCell>
                      {student.parent?.fullName ?? "—"}
                      <span className="block text-xs text-muted-foreground">
                        {student.parent?.phone ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(student)}>
                        <Pencil className="mr-2 size-4" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      <EditStudentDialog
        student={editing}
        classes={classesQuery.data ?? []}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function EditStudentDialog({
  student,
  classes,
  onClose,
}: {
  student: Student | null;
  classes: Awaited<ReturnType<typeof listClasses>>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});

  const current = (key: string, fallback: string) => form[key] ?? fallback;

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateStudent>[0]) => updateStudent(payload),
    onSuccess: () => {
      toast.success("Student updated");
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      onClose();
      setForm({});
    },
    onError: (error) => {
      toast.error("Couldn't save changes", {
        description: error instanceof Error ? error.message : "Please check the values.",
      });
    },
  });

  if (!student) return null;

  const numberOrNull = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit student</DialogTitle>
          <DialogDescription>
            Changing the parent phone number also changes that parent's password-reset contact and
            login.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Student name" className="sm:col-span-2">
            <Input
              value={current("fullName", student.full_name)}
              onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
            />
          </Field>
          <Field label="GR number">
            <Input
              value={current("grNumber", student.gr_number)}
              onChange={(event) => setForm((prev) => ({ ...prev, grNumber: event.target.value }))}
            />
          </Field>
          <Field label="Roll number">
            <Input
              value={current("rollNumber", student.roll_number ?? "")}
              onChange={(event) => setForm((prev) => ({ ...prev, rollNumber: event.target.value }))}
            />
          </Field>
          <Field label="Class" className="sm:col-span-2">
            <Select
              value={current("classId", student.class_id ?? "none")}
              onValueChange={(value) => setForm((prev) => ({ ...prev, classId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="No class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No class</SelectItem>
                {classes.map((schoolClass) => (
                  <SelectItem key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                    {schoolClass.division ? ` ${schoolClass.division}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Height (cm)">
            <Input
              inputMode="decimal"
              value={current("heightCm", student.height_cm ? String(student.height_cm) : "")}
              onChange={(event) => setForm((prev) => ({ ...prev, heightCm: event.target.value }))}
            />
          </Field>
          <Field label="Weight (kg)">
            <Input
              inputMode="decimal"
              value={current("weightKg", student.weight_kg ? String(student.weight_kg) : "")}
              onChange={(event) => setForm((prev) => ({ ...prev, weightKg: event.target.value }))}
            />
          </Field>
          <Field label="Date of birth">
            <Input
              type="date"
              value={current("dateOfBirth", student.date_of_birth ?? "")}
              onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
            />
          </Field>
          <Field label="Parent name">
            <Input
              value={current("parentName", student.parent?.fullName ?? "")}
              onChange={(event) => setForm((prev) => ({ ...prev, parentName: event.target.value }))}
            />
          </Field>
          <Field label="Parent phone number" className="sm:col-span-2">
            <Input
              inputMode="numeric"
              value={current("parentPhone", student.parent?.phone ?? "")}
              onChange={(event) => setForm((prev) => ({ ...prev, parentPhone: event.target.value }))}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              const classValue = current("classId", student.class_id ?? "none");
              const phone = current("parentPhone", student.parent?.phone ?? "").trim();
              mutation.mutate({
                data: {
                  studentId: student.id,
                  fullName: current("fullName", student.full_name).trim(),
                  grNumber: current("grNumber", student.gr_number).trim(),
                  rollNumber: current("rollNumber", student.roll_number ?? "").trim(),
                  classId: classValue === "none" ? null : classValue,
                  heightCm: numberOrNull(
                    current("heightCm", student.height_cm ? String(student.height_cm) : ""),
                  ),
                  weightKg: numberOrNull(
                    current("weightKg", student.weight_kg ? String(student.weight_kg) : ""),
                  ),
                  dateOfBirth: current("dateOfBirth", student.date_of_birth ?? ""),
                  parentName: current("parentName", student.parent?.fullName ?? "").trim(),
                  ...(phone ? { parentPhone: phone } : {}),
                },
              });
            }}
          >
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
