import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { useState } from "react";

import { DataTable } from "@/components/common/data-table";
import { PageHeader, SectionCard } from "@/components/common/section-card";
import { CountTile } from "@/components/common/stat-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { RoleGate } from "@/components/layout/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminAttendanceReport,
  adminListClasses,
  type AttendanceReportRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance reports — Dawn Breakers School Admin" },
      {
        name: "description",
        content:
          "Class and division attendance reports for any date range, with per-student totals and attendance percentage.",
      },
      { property: "og:title", content: "Attendance reports — Dawn Breakers School Admin" },
      {
        property: "og:description",
        content: "Class attendance totals and percentages for any date range.",
      },
    ],
  }),
  component: () => (
    <RoleGate role="admin">
      <AttendanceReports />
    </RoleGate>
  ),
});

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function AttendanceReports() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [classId, setClassId] = useState("");
  const [from, setFrom] = useState(isoDay(monthStart));
  const [to, setTo] = useState(isoDay(today));

  const classesQuery = useQuery({ queryKey: ["admin", "classes"], queryFn: () => adminListClasses() });
  const classes = classesQuery.data ?? [];
  const selectedClass = classId || classes[0]?.id || "";

  const reportQuery = useQuery({
    queryKey: ["admin", "attendance-report", selectedClass, from, to],
    enabled: Boolean(selectedClass),
    queryFn: () => adminAttendanceReport({ data: { classId: selectedClass, from, to } }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance reports"
        description="Built from the attendance teachers record — pick a class and a date range."
      />

      {classesQuery.isLoading ? (
        <LoadingCards count={2} />
      ) : classes.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Create a class before running attendance reports."
          icon={<CalendarCheck className="size-5" strokeWidth={1.75} />}
        />
      ) : (
        <>
          <SectionCard title="Filters">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {classes.map((row) => {
                  const label = `${row.name}${row.division ? `-${row.division}` : ""}`;
                  const active = selectedClass === row.id;
                  return (
                    <Button
                      key={row.id}
                      variant={active ? "default" : "outline"}
                      size="sm"
                      onClick={() => setClassId(row.id)}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={from}
                    max={to}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={to}
                    min={from}
                    max={isoDay(today)}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {reportQuery.isLoading ? (
            <LoadingCards count={3} />
          ) : reportQuery.isError ? (
            <ErrorState
              title="We couldn't build the report"
              description="Please try again in a moment."
              onRetry={() => void reportQuery.refetch()}
            />
          ) : (
            <>
              <SectionCard
                title="Class totals"
                description={
                  reportQuery.data?.totals.percent === null
                    ? "No attendance recorded in this range"
                    : `${reportQuery.data?.totals.percent}% present across ${reportQuery.data?.totals.total} records`
                }
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <CountTile label="Present" value={reportQuery.data?.totals.present ?? 0} tone="teal" />
                  <CountTile label="Absent" value={reportQuery.data?.totals.absent ?? 0} tone="coral" />
                  <CountTile label="Late" value={reportQuery.data?.totals.late ?? 0} tone="gold" />
                  <CountTile
                    label="Left early"
                    value={reportQuery.data?.totals.leftEarly ?? 0}
                    tone="gold"
                  />
                  <CountTile label="Other" value={reportQuery.data?.totals.other ?? 0} tone="muted" />
                </div>
              </SectionCard>

              <SectionCard title="Students">
                <DataTable<AttendanceReportRow>
                  columns={[
                    { key: "roll", header: "Roll", cell: (row) => row.rollNumber ?? "—" },
                    { key: "name", header: "Student", cell: (row) => row.fullName },
                    { key: "gr", header: "GR", cell: (row) => row.grNumber },
                    { key: "present", header: "Present", cell: (row) => row.present },
                    { key: "absent", header: "Absent", cell: (row) => row.absent },
                    { key: "late", header: "Late", cell: (row) => row.late },
                    { key: "left", header: "Left early", cell: (row) => row.leftEarly },
                    { key: "other", header: "Other", cell: (row) => row.other },
                    { key: "total", header: "Records", cell: (row) => row.total },
                    {
                      key: "percent",
                      header: "Attendance",
                      cell: (row) => (row.percent === null ? "—" : `${row.percent}%`),
                    },
                  ]}
                  rows={reportQuery.data?.rows ?? []}
                  getRowKey={(row) => row.studentId}
                  emptyTitle="No students in this class yet"
                  emptyDescription="Add students to this class to see attendance here."
                />
              </SectionCard>
            </>
          )}
        </>
      )}
    </div>
  );
}
