import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Link2, School, Users } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { StatCard } from "@/components/common/stat-card";
import { ErrorState, LoadingCards } from "@/components/common/states";
import { RoleGate } from "@/components/layout/role-gate";
import { Button } from "@/components/ui/button";
import type { NavPath } from "@/components/layout/nav-config";
import { getAdminOverview } from "@/lib/school.functions";

type NavTarget = NavPath;


export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "School overview — Dawn Breakers School Admin" },
      {
        name: "description",
        content:
          "Admin area for managing students, classes, teachers and parent–student links across Dawn Breakers School.",
      },
      { property: "og:title", content: "School overview — Dawn Breakers School Admin" },
      {
        property: "og:description",
        content: "Manage students, classes, teachers and parent–student links across the school.",
      },
    ],
  }),

  component: () => (
    <RoleGate role="admin">
      <AdminArea />
    </RoleGate>
  ),
});

const managementSections: { title: string; description: string; to: NavTarget; cta: string }[] = [
  {
    title: "Students",
    description: "Add students, set class and division, roll number, date of birth and photo.",
    to: "/admin/students",
    cta: "Manage students",
  },
  {
    title: "Classes & divisions",
    description: "Create classes per academic year and see their strength.",
    to: "/admin/classes",
    cta: "Manage classes",
  },
  {
    title: "Teachers",
    description: "Add teacher logins and assign them to classes and subjects.",
    to: "/admin/teachers",
    cta: "Manage teachers",
  },
  {
    title: "Excel import",
    description: "Bulk-add students from the official workbook, and review past imports.",
    to: "/admin/import",
    cta: "Open importer",
  },
];


function AdminArea() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => getAdminOverview(),
  });

  if (isLoading) return <LoadingCards count={4} />;

  if (isError) {
    return (
      <ErrorState
        title="We couldn't load the school overview"
        description="Please try again in a moment."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="School overview"
        description="Full management access to students, classes, teachers and family links."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={data?.students ?? 0} icon={Users} />
        <StatCard label="Classes" value={data?.classes ?? 0} icon={School} />
        <StatCard label="Teachers" value={data?.teachers ?? 0} icon={GraduationCap} />
        <StatCard label="Parent links" value={data?.parentLinks ?? 0} icon={Link2} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {managementSections.map((section) => (
          <SectionCard key={section.title} title={section.title} description={section.description}>
            <Button asChild variant="outline">
              <Link to={section.to}>{section.cta}</Link>
            </Button>
          </SectionCard>
        ))}
      </div>

    </div>
  );
}
