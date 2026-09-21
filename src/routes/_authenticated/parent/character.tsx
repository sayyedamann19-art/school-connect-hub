import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Award, Minus, Plus } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingCards } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { ChildSwitcher } from "@/components/parent/child-switcher";
import { getMyChildren, getStudentCharacterPoints } from "@/lib/school.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/parent/character")({
  head: () => ({
    meta: [
      { title: "Character card — Dawn Breakers School" },
      {
        name: "description",
        content:
          "Character card points and the reasons teachers recorded them, in line with Morality Before Materiality.",
      },
      { property: "og:title", content: "Character card — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Every character point recorded by your child's teachers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CharacterPage,
});

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function CharacterPage() {
  const [activeId, setActiveId] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["parent", "children"],
    queryFn: () => getMyChildren(),
  });

  const childrenList = childrenQuery.data?.children ?? [];
  const activeChildId = activeId ?? childrenList[0]?.id ?? null;
  const child = childrenList.find((row) => row.id === activeChildId) ?? null;

  const pointsQuery = useQuery({
    queryKey: ["parent", "character-points", activeChildId],
    enabled: Boolean(activeChildId),
    queryFn: () => getStudentCharacterPoints({ data: { studentId: activeChildId! } }),
  });

  if (childrenQuery.isLoading) return <LoadingCards count={2} />;

  if (childrenQuery.isError) {
    return (
      <ErrorState
        title="We couldn't load the character card"
        description="Please try again in a moment."
        onRetry={() => void childrenQuery.refetch()}
      />
    );
  }

  if (!child) {
    return (
      <EmptyState
        title="No children linked to your account yet"
        description="Please contact the school office so your child's record can be linked to this login."
      />
    );
  }

  const entries = pointsQuery.data?.entries ?? [];
  const score = entries.reduce((sum, entry) => sum + entry.points, 0);
  const positive = entries
    .filter((entry) => entry.points > 0)
    .reduce((sum, entry) => sum + entry.points, 0);
  const negative = entries
    .filter((entry) => entry.points < 0)
    .reduce((sum, entry) => sum + Math.abs(entry.points), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Character card</h1>
        <p className="meta-text mt-1.5">{child.full_name} · Morality Before Materiality</p>
      </header>

      {childrenList.length > 1 ? (
        <ChildSwitcher
          childrenList={childrenList}
          activeId={child.id}
          onSelect={(id) => setActiveId(id)}
        />
      ) : null}

      <section className="card-surface overflow-hidden bg-primary p-5 text-primary-foreground">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gold">
          Current score
        </p>
        <p className="metric-number mt-2">{score}</p>
        <div className="mt-4 flex gap-2.5">
          <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-3 py-1 text-xs font-semibold">
            <Plus className="size-3.5" strokeWidth={2.25} />
            {positive} earned
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-3 py-1 text-xs font-semibold">
            <Minus className="size-3.5" strokeWidth={2.25} />
            {negative} deducted
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Point history</h2>
        {pointsQuery.isLoading ? (
          <LoadingCards count={2} />
        ) : pointsQuery.isError ? (
          <ErrorState
            title="We couldn't load the point history"
            onRetry={() => void pointsQuery.refetch()}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            title="No character points yet"
            description="Points recorded by your child's teachers will appear here."
            icon={<Award className="size-5" strokeWidth={1.75} />}
          />
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className="card-surface flex gap-3.5 p-4">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
                  entry.points >= 0 ? "bg-teal-soft text-teal" : "bg-danger-soft text-danger",
                )}
              >
                {entry.points > 0 ? `+${entry.points}` : entry.points}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={entry.points >= 0 ? "success" : "danger"}>
                    {entry.points >= 0 ? "Earned" : "Deducted"}
                  </StatusBadge>
                </div>
                {entry.reason ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{entry.reason}</p>
                ) : null}
                <p className="meta-text mt-2">
                  {entry.teacher_name} · {formatDate(entry.awarded_on)}
                </p>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
