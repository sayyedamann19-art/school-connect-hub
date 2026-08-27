import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, CalendarCheck, ChevronLeft, NotebookPen, Percent } from "lucide-react";

import { DefinitionList, PageHeader, SectionCard } from "@/components/common/section-card";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { classLabel, initials } from "@/components/common/student-card";
import { RoleGate } from "@/components/layout/role-gate";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStudentOverview } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/parent/student/$studentId")({
  head: () => ({
    meta: [
      { title: "Student profile — School Connect" },
      {
        name: "description",
        content:
          "Student profile with class details, attendance summary, teacher notes and character card score.",
      },
      { property: "og:title", content: "Student profile — School Connect" },
      {
        property: "og:description",
        content: "Class details, attendance summary, teacher notes and character card score.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RoleGate role="parent">
      <StudentProfile />
    </RoleGate>
  ),
});

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StudentProfile() {
  const { studentId } = Route.useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", studentId, "overview"],
    queryFn: () => getStudentOverview({ data: { studentId } }),
  });

  if (isLoading) return <LoadingCards count={3} />;

  if (isError) {
    return (
      <ErrorState
        title="We couldn't load this profile"
        description="Please try again, or go back to your children."
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Student not available"
        description="This student isn't linked to your account."
      />
    );
  }

  const { student, summary } = data;

  return (
    <div className="space-y-6">
      <Link
        to="/parent"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        My children
      </Link>

      <div className="card-surface flex flex-wrap items-center gap-4 p-5">
        <Avatar className="size-16 border border-border">
          <AvatarFallback className="bg-primary-soft text-base font-semibold text-primary">
            {initials(student.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <PageHeader title={student.full_name} description={classLabel(student.class)} />
          <div className="mt-3 flex flex-wrap gap-2">
            {student.roll_number ? (
              <StatusBadge tone="primary">Roll {student.roll_number}</StatusBadge>
            ) : null}
            <StatusBadge tone={student.is_active ? "success" : "neutral"}>
              {student.is_active ? "Active" : "Inactive"}
            </StatusBadge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance records"
          value={summary.attendanceRecords}
          icon={CalendarCheck}
        />
        <StatCard
          label="Present rate"
          value={summary.presentRate === null ? "—" : `${summary.presentRate}%`}
          hint="All recorded days"
          icon={Percent}
        />
        <StatCard label="Character score" value={summary.characterScore} icon={Award} />
        <StatCard label="Teacher notes" value={summary.noteCount} icon={NotebookPen} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="notes">Teacher notes</TabsTrigger>
          <TabsTrigger value="character">Character card</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <SectionCard title="Student details">
            <DefinitionList
              items={[
                { label: "Full name", value: student.full_name },
                { label: "Class / division", value: classLabel(student.class) },
                { label: "Roll number", value: student.roll_number ?? "—" },
                { label: "Date of birth", value: formatDate(student.date_of_birth) },
                { label: "Academic year", value: student.class?.academic_year ?? "—" },
                { label: "Photo", value: student.photo_path ? "On file" : "Not uploaded" },
              ]}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <SectionCard title="Attendance" description="Daily records, monthly and yearly trends.">
            <EmptyState
              title="Attendance module coming next"
              description="Present, absent, late, left early and other markings with monthly and yearly percentages will appear here."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <SectionCard title="Teacher notes" description="Notes shared by teachers for this child.">
            <EmptyState
              title="Teacher notes module coming next"
              description="Each note will show the teacher, date, subject or class, and the note itself."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="character" className="mt-4">
          <SectionCard
            title="Character card"
            description="Positive and negative points with full history."
          >
            <EmptyState
              title="Character card module coming next"
              description="Current score, point history, reasons, awarding teacher and dates will appear here."
            />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
