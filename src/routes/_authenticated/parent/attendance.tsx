import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useT, localeFor, useI18n } from "@/lib/i18n";

import { CountTile } from "@/components/common/stat-card";
import { EmptyState, ErrorState, LoadingCards, LoadingRows } from "@/components/common/states";
import { ChildSwitcher } from "@/components/parent/child-switcher";
import { AttendanceRing, TrendChart } from "@/components/parent/progress-visuals";
import { Button } from "@/components/ui/button";
import { getMyChildren, getStudentAttendance, type AttendanceRecord } from "@/lib/school.functions";
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

type Status = AttendanceRecord["status"];

const dayTone: Record<Status, string> = {
  present: "bg-teal-soft text-teal",
  absent: "bg-danger-soft text-danger",
  late: "bg-gold-soft text-warning-foreground",
  left_early: "bg-info-soft text-info",
  other: "bg-muted text-muted-foreground",
};

/** Attendance percentage mirrors the app's existing rule: present / total records. */
function percentOf(records: AttendanceRecord[]): number | null {
  if (records.length === 0) return null;
  const present = records.filter((row) => row.status === "present").length;
  return Math.round((present / records.length) * 100);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function verdictFor(t: (s: string) => string, percent: number | null) {
  if (percent === null) return t("No attendance recorded yet");
  if (percent >= 95) return t("Outstanding attendance");
  if (percent >= 90) return t("Excellent attendance");
  if (percent >= 75) return t("Attendance needs attention");
  return t("Attendance is a concern");
}

function AttendancePage() {
  const t = useT();
  const { lang } = useI18n();

  const legend: { state: Status; label: string }[] = useMemo(() => [
    { state: "present", label: t("Present") },
    { state: "absent", label: t("Absent") },
    { state: "late", label: t("Late") },
    { state: "left_early", label: t("Left early") },
    { state: "other", label: t("Other") },
  ], [t]);

  const monthNames = useMemo(() => [
    t("January"), t("February"), t("March"), t("April"), t("May"), t("June"),
    t("July"), t("August"), t("September"), t("October"), t("November"), t("December"),
  ], [t]);

  const childrenQuery = useQuery({
    queryKey: ["parent", "children"],
    queryFn: () => getMyChildren(),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const childrenList = childrenQuery.data?.children ?? [];
  const activeChild = childrenList.find((child) => child.id === selectedId) ?? childrenList[0];

  const attendanceQuery = useQuery({
    queryKey: ["parent", "attendance", activeChild?.id],
    queryFn: () => getStudentAttendance({ data: { studentId: activeChild!.id } }),
    enabled: Boolean(activeChild?.id),
  });

  const records = attendanceQuery.data?.records ?? [];

  const stats = useMemo(() => {
    const count = (status: Status) => records.filter((row) => row.status === status).length;
    return {
      total: records.length,
      present: count("present"),
      absent: count("absent"),
      late: count("late"),
      leftEarly: count("left_early"),
      other: count("other"),
      percent: percentOf(records),
    };
  }, [records]);

  const byMonth = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const row of records) {
      const key = monthKey(row.date);
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return map;
  }, [records]);

  const monthKeys = useMemo(() => Array.from(byMonth.keys()).sort(), [byMonth]);

  // Calendar month: newest month with records, shifted by the user's navigation.
  const latestKey = monthKeys[monthKeys.length - 1];
  const baseIndex = monthKeys.length ? monthKeys.length - 1 : 0;
  const viewIndex = Math.min(Math.max(baseIndex + monthOffset, 0), Math.max(monthKeys.length - 1, 0));
  const viewKey = monthKeys[viewIndex] ?? latestKey;

  const calendar = useMemo(() => {
    if (!viewKey) return null;
    const [yearText, monthText] = viewKey.split("-");
    const year = Number(yearText);
    const month = Number(monthText) - 1;
    const statusByDay = new Map<number, Status>();
    for (const row of byMonth.get(viewKey) ?? []) {
      statusByDay.set(Number(row.date.slice(8, 10)), row.status);
    }
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = new Date(year, month, 1).getDay();
    return {
      label: `${monthNames[month]} ${year}`,
      leading,
      days: Array.from({ length: daysInMonth }, (_, index) => ({
        day: index + 1,
        state: statusByDay.get(index + 1) ?? null,
      })),
      percent: percentOf(byMonth.get(viewKey) ?? []),
    };
  }, [byMonth, viewKey, monthNames]);

  const trend = useMemo(
    () =>
      monthKeys.slice(-6).map((key) => {
        const month = Number(key.split("-")[1]) - 1;
        return {
          label: monthNames[month]!.slice(0, 3),
          value: percentOf(byMonth.get(key) ?? []) ?? 0,
        };
      }),
    [byMonth, monthKeys, monthNames],
  );

  const monthly = useMemo(
    () =>
      [...monthKeys].reverse().map((key) => {
        const [year, monthText] = key.split("-");
        return {
          key,
          month: `${monthNames[Number(monthText) - 1]} ${year}`,
          percent: percentOf(byMonth.get(key) ?? []) ?? 0,
        };
      }),
    [byMonth, monthKeys, monthNames],
  );

  if (childrenQuery.isLoading) return <LoadingCards count={1} />;

  if (childrenQuery.isError) {
    return (
      <ErrorState
        title={t("We couldn't load your children")}
        description={t("Please try again in a moment.")}
        onRetry={() => void childrenQuery.refetch()}
      />
    );
  }

  if (!activeChild) {
    return (
      <EmptyState
        title={t("No children linked to your account yet")}
        description={t("Please contact the school office so your child's record can be linked to this login.")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">{t("Attendance")}</h1>
        <p className="meta-text mt-1.5">
          {activeChild.full_name}
          {activeChild.class
            ? t(" · Class {name}", { name: activeChild.class.division ? `${activeChild.class.name}-${activeChild.class.division}` : activeChild.class.name })
            : ""}
        </p>
      </header>

      <ChildSwitcher
        childrenList={childrenList.map((child) => ({
          id: child.id,
          full_name: child.full_name,
          photoUrl: child.photoUrl,
        }))}
        activeId={activeChild.id}
        onSelect={(id) => {
          setSelectedId(id);
          setMonthOffset(0);
        }}
      />

      {attendanceQuery.isLoading ? (
        <LoadingRows count={6} />
      ) : attendanceQuery.isError ? (
        <ErrorState
          title={t("We couldn't load attendance")}
          description={t("Please try again in a moment.")}
          onRetry={() => void attendanceQuery.refetch()}
        />
      ) : stats.total === 0 ? (
        <EmptyState
          title={t("No attendance recorded yet")}
          description={t("The school hasn't marked any attendance for {name} so far.", { name: activeChild.full_name })}
        />
      ) : (
        <>
          <section className="card-surface flex flex-col items-center gap-5 p-5 sm:flex-row sm:gap-7">
            <AttendanceRing percent={stats.percent ?? 0} />
            <div className="w-full space-y-3">
              <p className="section-title">{verdictFor(t, stats.percent)}</p>
              <p className="meta-text">{t("{n} records marked", { n: stats.total })}</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                <CountTile label={t("Present")} value={stats.present} tone="teal" />
                <CountTile label={t("Absent")} value={stats.absent} tone="coral" />
                <CountTile label={t("Late")} value={stats.late} tone="gold" />
                <CountTile label={t("Left early")} value={stats.leftEarly} tone="info" />
                <CountTile label={t("Other")} value={stats.other} tone="neutral" />
              </div>
            </div>
          </section>

          {calendar ? (
            <section className="card-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("Previous month")}
                    disabled={viewIndex === 0}
                    onClick={() => setMonthOffset((value) => value - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <h2 className="section-title">{calendar.label}</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("Next month")}
                    disabled={viewIndex >= monthKeys.length - 1}
                    onClick={() => setMonthOffset((value) => value + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {legend.map((item) => (
                    <span key={item.state} className="flex items-center gap-1.5">
                      <span
                        className={cn("size-2.5 rounded-full", dayTone[item.state].split(" ")[0])}
                      />
                      <span className="meta-text">{item.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
                {[t("S"), t("M"), t("T"), t("W"), t("T"), t("F"), t("S")].map((day, index) => (
                  <span key={`${day}-${index}`} className="eyebrow py-1">
                    {day}
                  </span>
                ))}
                {Array.from({ length: calendar.leading }).map((_, index) => (
                  <span key={`pad-${index}`} aria-hidden />
                ))}
                {calendar.days.map((entry) => (
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

              <p className="meta-text mt-3">
                {calendar.percent === null
                  ? t("No records marked this month.")
                  : t("{percent}% present this month. Days without a mark are school holidays or not yet recorded.", { percent: calendar.percent })}
              </p>
            </section>
          ) : null}

          {trend.length > 1 ? (
            <section className="card-surface p-5">
              <h2 className="section-title">{t("Recent month trend")}</h2>
              <div className="mt-4">
                <TrendChart data={trend} />
              </div>
            </section>
          ) : null}

          <section className="card-surface overflow-hidden">
            <h2 className="section-title border-b border-border px-5 py-4">{t("Monthly history")}</h2>
            <ul className="divide-y divide-border">
              {monthly.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
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
        </>
      )}
    </div>
  );
}
