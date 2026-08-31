import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "@/components/common/status-badge";
import { ChildSwitcher, useActiveChild } from "@/components/parent/child-switcher";
import { TraitBar } from "@/components/parent/progress-visuals";
import { characterByChild, children } from "@/lib/mock/school-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/parent/character")({
  head: () => ({
    meta: [
      { title: "Character card — Dawn Breakers School" },
      {
        name: "description",
        content:
          "Character card points, trait-by-trait progress and the reasons teachers recorded them, in line with Morality Before Materiality.",
      },
      { property: "og:title", content: "Character card — Dawn Breakers School" },
      {
        property: "og:description",
        content: "Trait progress and every point recorded by your child's teachers.",
      },
    ],
  }),
  component: CharacterPage,
});

function CharacterPage() {
  const [activeId, setActiveId] = useState(children[0]!.id);
  const child = useActiveChild(activeId);
  const card = characterByChild[child.id]!;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Character card</h1>
        <p className="meta-text mt-1.5">
          {child.name} · Morality Before Materiality
        </p>
      </header>

      <ChildSwitcher activeId={activeId} onSelect={setActiveId} />

      <section className="card-surface overflow-hidden bg-primary p-5 text-primary-foreground">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gold">
          Term score
        </p>
        <p className="metric-number mt-2">{card.score}</p>
        <div className="mt-4 flex gap-2.5">
          <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-3 py-1 text-xs font-semibold">
            <Plus className="size-3.5" strokeWidth={2.25} />
            {card.positive} earned
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-3 py-1 text-xs font-semibold">
            <Minus className="size-3.5" strokeWidth={2.25} />
            {card.negative} deducted
          </span>
        </div>
      </section>

      <section className="card-surface space-y-4 p-5">
        <h2 className="section-title">Traits</h2>
        {card.traits.map((trait) => (
          <TraitBar key={trait.name} {...trait} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Point history</h2>
        {card.history.map((entry) => (
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
                <p className="text-sm font-bold text-foreground">{entry.trait}</p>
                <StatusBadge tone={entry.points >= 0 ? "success" : "danger"}>
                  {entry.points >= 0 ? "Earned" : "Deducted"}
                </StatusBadge>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{entry.reason}</p>
              <p className="meta-text mt-2">
                {entry.teacher} · {entry.date}
              </p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
