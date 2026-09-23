import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Users } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { setStudentActive } from "@/lib/students.functions";


import { DataTable } from "@/components/common/data-table";
import { PageHeader, SectionCard } from "@/components/common/section-card";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { RoleGate } from "@/components/layout/role-gate";
import { getTeacherOverview } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/teacher/")({
  head: () => ({
    meta: [
      { title: "My classes — Dawn Breakers School Teacher Area" },
      {
        name: "description",
        content:
          "Teacher area for assigned classes and students, with permitted notes and character card points.",
      },
      { property: "og:title", content: "My classes — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Assigned classes and students, with permitted notes and character card points.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="teacher">
      <TeacherArea />
    </RoleGate>
  ),
});

type StudentRow = {
  id: string;
  full_name: string;
  roll_number: string | null;
  class_id: string | null;
  is_active: boolean;
};

function TeacherArea() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["teacher", "overview"],
    queryFn: () => getTeacherOverview(),
  });

  const activeMutation = useMutation({
    mutationFn: (payload: { studentId: string; isActive: boolean }) =>
      setStudentActive({ data: payload }),
    onSuccess: (_result, variables) => {
      toast.success(
        variables.isActive
          ? "Student marked as studying again"
          : "Student marked as left — their records are kept",
      );
      void queryClient.invalidateQueries({ queryKey: ["teacher"] });
      void queryClient.invalidateQueries({ queryKey: ["parent"] });
    },
    onError: (error) =>
      toast.error("Couldn't update the student", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });


  if (isLoading) return <LoadingCards count={3} />;

  if (isError) {
    return (
      <ErrorState
        title="We couldn't load your classes"
        description="Please try again in a moment."
        onRetry={() => void refetch()}
      />
    );
  }

  const assignments = data?.assignments ?? [];
  const students = (data?.students ?? []) as StudentRow[];
  const classNameById = new Map(
    assignments
      .filter((row) => row.class)
      .map((row) => [
        row.class!.id,
        row.class!.division ? `${row.class!.name} · ${row.class!.division}` : row.class!.name,
      ]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher area"
        description="Your assigned classes and the students you can record notes and points for."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Assigned classes" value={assignments.length} icon={GraduationCap} />
        <StatCard label="Students in scope" value={students.length} icon={Users} />
      </div>

      <SectionCard title="My class assignments">
        {assignments.length === 0 ? (
          <EmptyState
            title="No classes assigned yet"
            description="An administrator assigns classes and subjects to your account."
          />
        ) : (
          <ul className="divide-y divide-border">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="text-sm font-medium text-foreground">
                  {assignment.class
                    ? assignment.class.division
                      ? `${assignment.class.name} · ${assignment.class.division}`
                      : assignment.class.name
                    : "Class removed"}
                </span>
                {assignment.subject ? (
                  <StatusBadge tone="info">{assignment.subject}</StatusBadge>
                ) : null}
                {assignment.is_class_teacher ? (
                  <StatusBadge tone="primary">Class teacher</StatusBadge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Students" description="Open Attendance, Feedback or Character to record for these students.">
        <DataTable<StudentRow>
          columns={[
            { key: "name", header: "Student", cell: (row) => row.full_name },
            { key: "roll", header: "Roll no.", cell: (row) => row.roll_number ?? "—" },
            {
              key: "class",
              header: "Class",
              cell: (row) => (row.class_id ? (classNameById.get(row.class_id) ?? "—") : "—"),
            },
            {
              key: "active",
              header: "Studying",
              cell: (row) => (
                <Switch
                  checked={row.is_active}
                  onCheckedChange={(checked) => {
                    if (
                      checked ||
                      window.confirm(
                        `Mark ${row.full_name} as left the school? Attendance, feedback and character records are kept.`,
                      )
                    ) {
                      activeMutation.mutate({ studentId: row.id, isActive: checked });
                    }
                  }}
                />
              ),
            },
          ]}
          rows={students}
          getRowKey={(row) => row.id}
          emptyTitle="No students in your classes yet"
          emptyDescription="Students appear here once they are added to a class you teach."
        />
      </SectionCard>
    </div>
  );
}
