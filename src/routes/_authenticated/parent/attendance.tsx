import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { CountTile } from "@/components/common/stat-card";
import { ChildSwitcher, useActiveChild } from "@/components/parent/child-switcher";
import { AttendanceRing, TrendChart } from "@/components/parent/progress-visuals";
import { attendanceByChild, children, type AttendanceState } from "@/lib/mock/school-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/parent/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Dawn Breakers School" },
      {
        name: "description",
        content:
          "Month-by-month attendance calendar, present and absent counts and six-month trends for your child at Dawn Breakers School.",
      },
      { property: "og:title", content: "Attendance — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Daily marks, monthly totals and attendance trends for your child.",
      },
    ],
  }),
  component: AttendancePage,
});

const dayTone: Record<AttendanceState, string> = {
  present: "bg-teal-soft text-teal",
  absent: "bg-danger-soft text-danger",
  late: "bg-gold-soft text-warning-foreground",
  left_early: "bg-info-soft text-info",
};

const legend: { state: AttendanceState; label: string }[] = [
  { state: "present", label: "Present" },
  { state: "absent", label: "Absent" },
  { state: "late", label: "Late" },
  { state: "left_early", label: "Left early" },
];

function AttendancePage() {
  const [activeId, setActiveId] = useState(children[0]!.id);
  const child = useActiveChild(activeId);
  const attendance = attendanceByChild[child.id]!;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Attendance</h1>
        <p className="meta-text mt-1.5">
          {child.name} · Class {child.className}-{child.division}
        </p>
      </header>

      <ChildSwitcher activeId={activeId} onSelect={setActiveId} />

      <section className="card-surface flex flex-col items-center gap-5 p-5 sm:flex-row sm:gap-7">
        <AttendanceRing percent={attendance.percent} />
        <div className="w-full space-y-3">
          <p className="section-title">{attendance.verdict}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <CountTile label="Present" value={attendance.present} tone="teal" />
            <CountTile label="Absent" value={attendance.absent} tone="coral" />
            <CountTile label="Late" value={attendance.late} tone="gold" />
            <CountTile label="Left early" value={attendance.leftEarly} tone="info" />
          </div>
        </div>
      </section>

      <section className="card-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">{attendance.month}</h2>
          <div className="flex flex-wrap gap-3">
            {legend.map((item) => (
              <span key={item.state} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-full", dayTone[item.state].split(" ")[0])} />
                <span className="meta-text">{item.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <span key={`${day}-${index}`} className="eyebrow py-1">
              {day}
            </span>
          ))}
          {attendance.days.map((entry) => (
            <span
              key={entry.day}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-xs font-bold tabular-nums",
                entry.state ? dayTone[entry.state] : "bg-muted/60 text-muted-foreground/70",
              )}
            >
              {entry.day}
            </span>
          ))}
        </div>
      </section>

      <section className="card-surface p-5">
        <h2 className="section-title">Six-month trend</h2>
        <div className="mt-4">
          <TrendChart data={attendance.trend} />
        </div>
      </section>

      <section className="card-surface overflow-hidden">
        <h2 className="section-title border-b border-border px-5 py-4">Monthly history</h2>
        <ul className="divide-y divide-border">
          {attendance.monthly.map((row) => (
            <li key={row.month} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <span className="text-sm font-semibold text-foreground">{row.month}</span>
              <span className="flex items-center gap-3">
                <span className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-teal"
                    style={{ width: `${row.percent}%` }}
                  />
                </span>
                <span className="w-10 text-right text-sm font-bold tabular-nums text-foreground">
                  {row.percent}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
