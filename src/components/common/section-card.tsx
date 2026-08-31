import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("card-surface", className)}>
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="section-title">{title}</h2>
            {description ? <p className="meta-text mt-1">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn("px-5 py-5", contentClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description ? <p className="meta-text mt-1.5">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function DefinitionList({
  items,
  className,
}: {
  items: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
