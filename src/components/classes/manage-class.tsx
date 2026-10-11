import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Users } from "lucide-react";

import { PageHeader } from "@/components/common/section-card";
import { ErrorState, LoadingCards } from "@/components/common/states";
import { StudentImportWizard } from "@/components/students/import-wizard";
import { Button } from "@/components/ui/button";
import { getManageClass } from "@/lib/import.functions";

/** Manage Class: class summary plus the shared Excel importer, locked to this class. */
export function ManageClass({ classId, scope }: { classId: string; scope: "admin" | "teacher" }) {
  const query = useQuery({
    queryKey: ["manage-class", classId],
    queryFn: () => getManageClass({ data: { classId } }),
  });

  if (query.isLoading) return <LoadingCards count={2} />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="We couldn't open this class"
        description={query.error instanceof Error ? query.error.message : "Please try again."}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const c = query.data;
  const label = `${c.name}${c.division ? ` · Division ${c.division}` : ""}`;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={scope === "admin" ? "/admin/classes" : "/teacher"}>
          <ArrowLeft className="mr-2 size-4" />
          {scope === "admin" ? "All classes" : "My classes"}
        </Link>
      </Button>
      <PageHeader
        title={`Manage ${label}`}
        description={`${c.academic_year} · ${c.studentCount} student${c.studentCount === 1 ? "" : "s"}. Import from Excel adds students to this class only.`}
        action={
          scope === "admin" ? (
            <Button asChild variant="outline">
              <Link to="/admin/students" search={{ classId: c.id }}>
                <Users className="mr-2 size-4" />
                View students
              </Link>
            </Button>
          ) : undefined
        }
      />
      <StudentImportWizard
        scope={scope}
        embedded
        targetClass={{ id: c.id, name: c.name, division: c.division, academicYear: c.academic_year }}
      />
    </div>
  );
}
