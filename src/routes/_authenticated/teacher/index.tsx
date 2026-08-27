import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Users } from "lucide-react";

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
      { title: "My classes — School Connect Teacher Area" },
      {
        name: "description",
        content:
          "Teacher area for assigned classes and students, with permitted notes and character card points.",
      },
      { property: "og:title", content: "My classes — School Connect" },
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
};

function TeacherArea() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["teacher", "overview"],
    queryFn: () => getTeacherOverview(),
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
        <StatCard label="Pending attendance" value="—" hint="Coming in the next module" />
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

      <SectionCard title="Students" description="Read-only in V1; recording tools come next.">
        <DataTable<StudentRow>
          columns={[
            { key: "name", header: "Student", cell: (row) => row.full_name },
            { key: "roll", header: "Roll no.", cell: (row) => row.roll_number ?? "—" },
            {
              key: "class",
              header: "Class",
              cell: (row) => (row.class_id ? (classNameById.get(row.class_id) ?? "—") : "—"),
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
