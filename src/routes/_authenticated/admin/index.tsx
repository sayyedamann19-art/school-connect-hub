import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, School, UserRound, Users } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/common/section-card";
import { StatCard } from "@/components/common/stat-card";
import { ErrorState, LoadingCards } from "@/components/common/states";
import { RoleGate } from "@/components/layout/role-gate";
import { adminAttendanceReport, adminListClasses, adminListParents } from "@/lib/admin.functions";
import { getAdminOverview } from "@/lib/school.functions";
import { adminListUpdates } from "@/lib/updates.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "School overview — Dawn Breakers School Admin" },
      {
        name: "description",
        content:
          "At-a-glance dashboard: students, classes, teachers, parents, today's attendance and recent updates at Dawn Breakers School.",
      },
      { property: "og:title", content: "School overview — Dawn Breakers School Admin" },
      {
        property: "og:description",
        content: "Students, classes, teachers, parents, today's attendance and recent school updates.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="admin">
      <AdminArea />
    </RoleGate>
  ),
});

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function AdminArea() {
  const today = todayIso();
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => getAdminOverview() });
  const parents = useQuery({
    queryKey: ["admin", "parents", ""],
    queryFn: () => adminListParents({ data: {} }),
  });
  const classes = useQuery({ queryKey: ["admin", "classes"], queryFn: () => adminListClasses() });
  const updates = useQuery({ queryKey: ["admin", "updates"], queryFn: () => adminListUpdates() });

  const reports = useQueries({
    queries: (classes.data ?? []).map((row) => ({
      queryKey: ["admin", "attendance-report", row.id, today, today],
      queryFn: () => adminAttendanceReport({ data: { classId: row.id, from: today, to: today } }),
    })),
  });

  if (overview.isLoading) return <LoadingCards count={4} />;
  if (overview.isError) {
    return (
      <ErrorState
        title="We couldn't load the school overview"
        description="Please try again in a moment."
        onRetry={() => void overview.refetch()}
      />
    );
  }

  const reportsLoading = classes.isLoading || reports.some((r) => r.isLoading);
  const totals = reports.reduce(
    (acc, r) => {
      const t = r.data?.totals;
      if (!t) return acc;
      acc.present += t.present;
      acc.absent += t.absent;
      acc.late += t.late;
      acc.leftEarly += t.leftEarly;
      acc.other += t.other;
      acc.total += t.total;
      return acc;
    },
    { present: 0, absent: 0, late: 0, leftEarly: 0, other: 0, total: 0 },
  );
  const percent = totals.total ? Math.round((totals.present / totals.total) * 100) : null;
  const classesMarked = reports.filter((r) => (r.data?.totals.total ?? 0) > 0).length;
  const recentUpdates = (updates.data ?? []).slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader title="School overview" description="A quick look at today across the school." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Students" value={overview.data?.students ?? 0} icon={Users} />
        <StatCard label="Classes" value={overview.data?.classes ?? 0} icon={School} />
        <StatCard label="Teachers" value={overview.data?.teachers ?? 0} icon={GraduationCap} />
        <StatCard
          label="Parents"
          value={parents.isLoading ? "…" : (parents.data?.length ?? 0)}
          icon={UserRound}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Today's attendance"
          description={new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        >
          {reportsLoading ? (
            <p className="meta-text">Loading…</p>
          ) : totals.total === 0 ? (
            <p className="meta-text">No attendance has been marked yet today.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <p className="text-3xl font-bold leading-none tabular-nums text-foreground">
                  {percent}%
                  <span className="ml-2 text-sm font-medium text-muted-foreground">present</span>
                </p>
                <p className="meta-text">
                  {classesMarked} of {classes.data?.length ?? 0} classes marked
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
                {[
                  ["Present", totals.present],
                  ["Absent", totals.absent],
                  ["Late", totals.late],
                  ["Left early", totals.leftEarly],
                  ["Other", totals.other],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-muted px-2 py-2">
                    <dd className="text-lg font-bold tabular-nums text-foreground">{value}</dd>
                    <dt className="meta-text">{label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent updates" contentClassName="p-0">
          {updates.isLoading ? (
            <p className="meta-text px-5 py-5">Loading…</p>
          ) : recentUpdates.length === 0 ? (
            <p className="meta-text px-5 py-5">No school updates yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentUpdates.map((update) => (
                <li key={update.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-foreground">{update.title}</p>
                    <span className="meta-text shrink-0">
                      {update.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="meta-text mt-0.5 line-clamp-1">{update.body}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
