import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Link2, School, Users } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { RoleGate } from "@/components/layout/role-gate";
import { getAdminOverview } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "School overview — School Connect Admin" },
      {
        name: "description",
        content:
          "Admin area for managing students, classes, teachers and parent–student links across the school.",
      },
      { property: "og:title", content: "School overview — School Connect Admin" },
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

const managementSections = [
  {
    title: "Students",
    description: "Add students, set class and division, roll number, date of birth and photo.",
  },
  { title: "Classes & divisions", description: "Create classes per academic year." },
  { title: "Teachers", description: "Invite teachers and assign them to classes and subjects." },
  {
    title: "Parent–student links",
    description: "Link parents to their children. Only admins can change these links.",
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
            <EmptyState
              title="Module coming next"
              description="This management screen will be built in a following step."
            />
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
