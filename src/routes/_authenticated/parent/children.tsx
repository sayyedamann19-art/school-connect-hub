import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { StudentAvatar } from "@/components/common/student-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { getMyChildren } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/parent/children")({
  head: () => ({
    meta: [
      { title: "My children — Dawn Breakers School" },
      {
        name: "description",
        content:
          "All children linked to your Dawn Breakers School parent account, with attendance and character card progress at a glance.",
      },
      { property: "og:title", content: "My children — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Every child linked to your parent account in one place.",
      },
    ],
  }),
  component: ChildrenPage,
});

function ChildrenPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent", "children"],
    queryFn: () => getMyChildren(),
  });

  if (isLoading) return <LoadingCards count={2} />;

  if (isError) {
    return (
      <ErrorState
        title="We couldn't load your children"
        description="Please try again in a moment."
        onRetry={() => void refetch()}
      />
    );
  }

  const childrenList = data?.children ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title">My children</h1>
        <p className="meta-text mt-1.5">
          {childrenList.length} student{childrenList.length === 1 ? "" : "s"} linked to this account.
        </p>
      </header>

      {childrenList.length === 0 ? (
        <EmptyState
          title="No children linked to your account yet"
          description="Please contact the school office so your child's record can be linked to this login."
        />
      ) : (
        <div className="space-y-3">
          {childrenList.map((child) => (
            <Link
              key={child.id}
              to="/parent/student/$studentId"
              params={{ studentId: child.id }}
              className="card-surface flex items-center gap-4 p-4 transition-shadow hover:shadow-[var(--shadow-card-hover)]"
            >
              <StudentAvatar
                name={child.full_name}
                src={child.photoUrl}
                tone="teal"
                className="size-14"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{child.full_name}</p>
                <p className="meta-text mt-0.5">
                  {child.class
                    ? `Class ${child.class.name}${child.class.division ? `-${child.class.division}` : ""}`
                    : "Class not assigned"}
                  {child.roll_number ? ` · Roll ${child.roll_number}` : ""} · GR {child.gr_number}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-4">
                  <span className="text-xs font-bold text-teal">
                    {child.attendance.percent === null ? "—" : `${child.attendance.percent}%`}{" "}
                    <span className="font-medium text-muted-foreground">attendance</span>
                  </span>
                  <span className="text-xs font-bold text-warning-foreground">
                    {child.characterScore}{" "}
                    <span className="font-medium text-muted-foreground">character points</span>
                  </span>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            </Link>
          ))}
        </div>
      )}

      <p className="meta-text">
        Siblings are grouped under one login. Contact the school office if a child is missing.
      </p>
    </div>
  );
}
