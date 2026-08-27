import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning-foreground border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-info-soft text-info border-info/20",
  primary: "bg-primary-soft text-primary border-primary/15",
};

export type AttendanceStatus = "present" | "absent" | "late" | "left_early" | "other";

export const attendanceMeta: Record<AttendanceStatus, { label: string; tone: StatusTone }> = {
  present: { label: "Present", tone: "success" },
  absent: { label: "Absent", tone: "danger" },
  late: { label: "Late", tone: "warning" },
  left_early: { label: "Left early", tone: "info" },
  other: { label: "Other", tone: "neutral" },
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const meta = attendanceMeta[status];
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
}
