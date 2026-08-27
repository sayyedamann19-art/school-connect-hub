import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type StudentCardStudent = {
  id: string;
  full_name: string;
  roll_number?: string | null;
  is_active?: boolean;
  class?: { name: string; division?: string | null } | null;
};

export function classLabel(klass?: { name: string; division?: string | null } | null) {
  if (!klass) return "Class not assigned";
  return klass.division ? `${klass.name} · ${klass.division}` : klass.name;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function StudentCard({
  student,
  subtitle,
  to,
  className,
}: {
  student: StudentCardStudent;
  subtitle?: string;
  to?: string;
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        "card-surface flex items-center gap-4 p-5 transition-shadow hover:shadow-[var(--shadow-card-hover)]",
        className,
      )}
    >
      <Avatar className="size-12 border border-border">
        <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">
          {initials(student.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{student.full_name}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {subtitle ?? classLabel(student.class)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {student.roll_number ? (
            <StatusBadge tone="primary">Roll {student.roll_number}</StatusBadge>
          ) : null}
          {student.is_active === false ? <StatusBadge tone="neutral">Inactive</StatusBadge> : null}
        </div>
      </div>
      {to ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
    </div>
  );

  if (!to) return body;

  return (
    <Link to={to} params={{ studentId: student.id }} className="block">
      {body}
    </Link>
  );
}
