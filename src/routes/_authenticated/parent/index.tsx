import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { PageHeader } from "@/components/common/section-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { StudentCard } from "@/components/common/student-card";
import { RoleGate } from "@/components/layout/role-gate";
import { getMyChildren } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/parent/")({
  head: () => ({
    meta: [
      { title: "My children — School Connect" },
      {
        name: "description",
        content:
          "Select one of your linked children to view attendance, teacher notes and character card progress.",
      },
      { property: "og:title", content: "My children — School Connect" },
      {
        property: "og:description",
        content: "Select a child to view attendance, teacher notes and character card progress.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="parent">
      <ParentDashboard />
    </RoleGate>
  ),
});

function ParentDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent", "children"],
    queryFn: () => getMyChildren(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My children"
        description="Choose a child to open their profile, attendance and character card."
      />

      {isLoading ? <LoadingCards count={2} /> : null}

      {isError ? (
        <ErrorState
          title="We couldn't load your children"
          description="Please check your connection and try again."
          onRetry={() => void refetch()}
        />
      ) : null}

      {data && data.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="No children linked yet"
          description="The school office links each child to their parent account. Contact the office if someone is missing."
        />
      ) : null}

      {data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map(({ student, relationship }) => (
            <StudentCard
              key={student.id}
              student={student}
              subtitle={`${student.class ? (student.class.division ? `${student.class.name} · ${student.class.division}` : student.class.name) : "Class not assigned"} • ${relationship}`}
              to="/parent/student/$studentId"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
