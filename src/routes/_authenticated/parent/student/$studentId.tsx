import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, CalendarCheck, ChevronLeft, NotebookPen, Percent } from "lucide-react";
import { useT, localeFor, useI18n } from "@/lib/i18n";

import { DefinitionList, PageHeader, SectionCard } from "@/components/common/section-card";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { classLabel } from "@/components/common/student-card";
import { RoleGate } from "@/components/layout/role-gate";
import { StudentPhotoEditor } from "@/components/parent/student-photo-editor";
import { getStudentOverview } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/parent/student/$studentId")({
  head: () => ({
    meta: [
      { title: "Student profile — Dawn Breakers School" },
      {
        name: "description",
        content:
          "Student profile with class details, attendance summary, teacher notes and character card score.",
      },
      { property: "og:title", content: "Student profile — Dawn Breakers School" },
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

function formatDate(lang: string, value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(localeFor(lang as any), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StudentProfile() {
  const t = useT();
  const { lang } = useI18n();
  const { studentId } = Route.useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", studentId, "overview"],
    queryFn: () => getStudentOverview({ data: { studentId } }),
  });

  if (isLoading) return <LoadingCards count={3} />;

  if (isError) {
    return (
      <ErrorState
        title={t("We couldn't load this profile")}
        description={t("Please try again, or go back to your children.")}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title={t("Student not available")}
        description={t("This student isn't linked to your account.")}
      />
    );
  }

  const { student, summary, photoUrl } = data;

  return (
    <div className="space-y-6">
      <Link
        to="/parent/children"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {t("My children")}
      </Link>

      <div className="card-surface flex flex-wrap items-center gap-4 p-5">
        <StudentPhotoEditor
          studentId={student.id}
          name={student.full_name}
          photoUrl={photoUrl}
        />
        <div className="min-w-0 flex-1">
          <PageHeader title={student.full_name} description={(student.class ? classLabel(student.class) : t("Class not assigned"))} />
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge tone="primary">{t("GR number")}: {student.gr_number}</StatusBadge>
            {student.roll_number ? (
              <StatusBadge tone="primary">{t("Roll {n}", { n: student.roll_number })}</StatusBadge>
            ) : null}
            <StatusBadge tone={student.is_active ? "success" : "neutral"}>
              {student.is_active ? t("Active") : t("Inactive")}
            </StatusBadge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("Attendance records")}
          value={summary.attendanceRecords}
          icon={CalendarCheck}
        />
        <StatCard
          label={t("Present rate")}
          value={summary.presentRate === null ? "—" : `${summary.presentRate}%`}
          hint={t("All recorded days")}
          icon={Percent}
        />
        <StatCard label={t("Character score")} value={summary.characterScore} icon={Award} />
        <StatCard label={t("Teacher notes")} value={summary.noteCount} icon={NotebookPen} />
      </div>

      <SectionCard title={t("Student details")}>
        <DefinitionList
          items={[
            { label: t("Full name"), value: student.full_name },
            { label: t("GR number"), value: student.gr_number },
            { label: t("Class / division"), value: (student.class ? classLabel(student.class) : t("Class not assigned")) },
            { label: t("Roll number"), value: student.roll_number ?? "—" },
            { label: t("Date of birth"), value: formatDate(lang, student.date_of_birth) },
            { label: t("Academic year"), value: student.class?.academic_year ?? "—" },
            {
              label: t("Height"),
              value: student.height_cm === null ? "—" : t("{n} cm", { n: student.height_cm }),
            },
            {
              label: t("Weight"),
              value: student.weight_kg === null ? "—" : t("{n} kg", { n: student.weight_kg }),
            },
            { label: t("Photo"), value: student.photo_path ? t("On file") : t("Not uploaded") },
          ]}
        />
      </SectionCard>
    </div>
  );
}
