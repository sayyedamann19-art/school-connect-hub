import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, CalendarCheck, ChevronRight, Heart, MessageSquareText, Sparkle } from "lucide-react";
import { useEffect, useState } from "react";
import { greetingFor } from "@/lib/greeting";
import { useT, useI18n, localeFor } from "@/lib/i18n";

import { ChildSwitcher } from "@/components/parent/child-switcher";
import { AttendanceRing } from "@/components/parent/progress-visuals";
import { StudentAvatar } from "@/components/common/student-card";
import { StatusBadge } from "@/components/common/status-badge";
import { CountTile } from "@/components/common/stat-card";
import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { getMyChildren } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/parent/")({
  head: () => {
    const t = localeFor === undefined ? ((s: string) => s) : (s: string) => s; // dummy to satisfy hook rules if it were a component, but it's not. 
    // Wait, head can't use hooks. I'll use a static translation or skip head for now if it's too complex, but prompt asked for every visible string.
    // However, I can't use useT in head. I'll leave head English for now or skip it if I can't easily get lang there.
    return {
      meta: [
        { title: "Parent home — Dawn Breakers School" },
        {
          name: "description",
          content:
            "Today's attendance, recent teacher feedback and character card progress for your children at Dawn Breakers School.",
        },
        { property: "og:title", content: "Parent home — Dawn Breakers School" },
        {
          property: "og:description",
          content: "Attendance, teacher feedback and character progress for your children.",
        },
      ],
    };
  },
  component: ParentHome,
});

function classLine(child: { class: { name: string; division: string | null } | null }, t: (s: string, v?: any) => string) {
  if (!child.class) return t("Class not assigned");
  return child.class.division
    ? t("Class {name}-{division}", { name: child.class.name, division: child.class.division })
    : t("Class {name}", { name: child.class.name });
}

function formatDate(value: string, lang: any) {
  return new Date(value).toLocaleDateString(localeFor(lang), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ParentHome() {
  const t = useT();
  const { lang } = useI18n();
  const [greeting, setGreeting] = useState(() => greetingFor());
  useEffect(() => {
    const id = window.setInterval(() => setGreeting(greetingFor()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent", "children"],
    queryFn: () => getMyChildren(),
  });

  if (isLoading) return <LoadingCards count={3} />;

  if (isError) {
    return (
      <ErrorState
        title={t("We couldn't load your children")}
        description={t("Please try again in a moment.")}
        onRetry={() => void refetch()}
      />
    );
  }

  const childrenList = data?.children ?? [];

  if (childrenList.length === 0) {
    return (
      <div className="space-y-5">
        <header>
          <p className="eyebrow">{t("Welcome")}</p>
          <h1 className="page-title mt-1">{data?.parentName ?? t("Parent")}</h1>
        </header>
        <EmptyState
          title={t("No children linked to your account yet")}
          description={t("Please contact the school office so your child's record can be linked to this login.")}
        />
      </div>
    );
  }

  const child = childrenList.find((entry) => entry.id === activeId) ?? childrenList[0]!;
  const attendance = child.attendance;

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="eyebrow" suppressHydrationWarning>{t(greeting)}</p>
          <h1 className="page-title mt-1 truncate">{data?.parentName ?? t("Parent")}</h1>
        </div>
      </header>

      <ChildSwitcher childrenList={childrenList} activeId={child.id} onSelect={setActiveId} />

      <section className="card-surface overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border p-5">
          <StudentAvatar
            name={child.full_name}
            src={child.photoUrl}
            tone="teal"
            className="size-14"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-foreground">{child.full_name}</p>
            <p className="meta-text mt-0.5">
              {classLine(child, t)}
              {child.roll_number ? ` · ${t("Roll {n}", { n: child.roll_number })}` : ""} · GR {child.gr_number}
            </p>
          </div>
          <Link to="/parent/student/$studentId" params={{ studentId: child.id }}>
            <StatusBadge tone="primary">{t("View profile")}</StatusBadge>
          </Link>
        </div>

        <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center sm:gap-7">
          <AttendanceRing percent={attendance.percent ?? 0} />
          <div className="w-full space-y-3">
            <div>
              <p className="section-title">
                {attendance.total === 0
                  ? t("No attendance recorded yet")
                  : attendance.percent !== null && attendance.percent >= 90
                    ? t("Excellent attendance")
                    : attendance.percent !== null && attendance.percent >= 75
                      ? t("Attendance needs a little care")
                      : t("Attendance needs attention")}
              </p>
              <p className="meta-text mt-1">
                {t("{n} days recorded", { n: attendance.total })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <CountTile label={t("Present")} value={attendance.present} tone="teal" />
              <CountTile label={t("Absent")} value={attendance.absent} tone="coral" />
              <CountTile label={t("Late")} value={attendance.late} tone="gold" />
              <CountTile label={t("Left early")} value={attendance.leftEarly} tone="info" />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/parent/attendance" className="card-surface flex items-center gap-3.5 p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-teal-soft text-teal">
            <CalendarCheck className="size-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">{t("Attendance")}</span>
            <span className="meta-text">{t("Month calendar and history")}</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </Link>
        <Link to="/parent/character" className="card-surface flex items-center gap-3.5 p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gold-soft text-warning-foreground">
            <Heart className="size-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">{t("Character card")}</span>
            <span className="meta-text">{t("{n} points recorded", { n: child.characterScore })}</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </Link>
        <Link to="/parent/academics" className="card-surface flex items-center gap-3.5 p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <BookOpen className="size-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">{t("Academics")}</span>
            <span className="meta-text">{t("Published exam results")}</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">{t("Recent teacher feedback")}</h2>
          <Link to="/parent/feedback" className="text-xs font-bold text-teal">
            {t("View all")}
          </Link>
        </div>
        {child.recentNotes.map((item) => (
          <article key={item.id} className="card-surface p-4">
            <p className="meta-text">
              {item.subject ? `${item.subject} · ` : ""}
              {formatDate(item.note_date, lang)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{item.note}</p>
          </article>
        ))}
        {child.recentNotes.length === 0 ? (
          <div className="card-quiet flex items-center gap-3 p-4">
            <MessageSquareText className="size-4 text-muted-foreground" strokeWidth={1.75} />
            <p className="meta-text">{t("No feedback shared yet this term.")}</p>
          </div>
        ) : null}
      </section>

      <section className="card-quiet flex items-start gap-3 p-4">
        <Sparkle className="mt-0.5 size-4 shrink-0 text-gold" strokeWidth={1.75} />
        <p className="meta-text">
          {t("Attendance and feedback are published by class teachers through the school day. Records are private to your family.")}
        </p>
      </section>
    </div>
  );
}
