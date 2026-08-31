import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const toneStyles = {
  neutral: "bg-muted text-muted-foreground",
  teal: "bg-teal-soft text-teal",
  gold: "bg-gold-soft text-warning-foreground",
  coral: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  navy: "bg-primary-soft text-primary",
} as const;

export type StatTone = keyof typeof toneStyles;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "navy",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div className={cn("card-surface p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              toneStyles[tone],
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
        ) : null}
      </div>
      <p className="mt-2.5 text-[1.75rem] font-bold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {hint ? <p className="meta-text mt-1.5">{hint}</p> : null}
    </div>
  );
}

/** Compact counter used in grids of four attendance states. */
export function CountTile({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  tone: StatTone;
  icon?: LucideIcon;
}) {
  return (
    <div className="card-quiet flex flex-col gap-2 p-3.5">
      <span
        className={cn("flex size-8 items-center justify-center rounded-lg", toneStyles[tone])}
      >
        {Icon ? <Icon className="size-4" strokeWidth={1.75} /> : null}
      </span>
      <div>
        <p className="text-xl font-bold leading-none tabular-nums text-foreground">{value}</p>
        <p className="meta-text mt-1">{label}</p>
      </div>
    </div>
  );
}
