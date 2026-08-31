import { cn } from "@/lib/utils";

/** Circular attendance meter — stroke colour follows the health of the number. */
export function AttendanceRing({
  percent,
  size = 132,
  label = "attendance",
  className,
}: {
  percent: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const radius = size / 2 - 9;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(percent, 0), 100) / 100);
  const stroke =
    percent >= 90 ? "var(--color-teal)" : percent >= 75 ? "var(--color-gold)" : "var(--color-danger)";

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={9}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="metric-number text-foreground">{percent}%</span>
        <span className="eyebrow mt-1">{label}</span>
      </div>
    </div>
  );
}

/** Six-month attendance trend, drawn as a soft area line. */
export function TrendChart({ data }: { data: { label: string; value: number }[] }) {
  const width = 320;
  const height = 96;
  const min = 80;
  const max = 100;
  const points = data.map((entry, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * width;
    const y = height - ((entry.value - min) / (max - min)) * height;
    return { x, y: Math.max(Math.min(y, height - 4), 4), ...entry };
  });
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" role="img" aria-label="Attendance trend">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-teal)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-teal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke="var(--color-teal)" strokeWidth={2.5} strokeLinecap="round" />
        {points.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r={3} fill="var(--color-surface)" stroke="var(--color-teal)" strokeWidth={2} />
        ))}
      </svg>
      <div className="mt-2 flex justify-between">
        {data.map((entry) => (
          <span key={entry.label} className="meta-text">
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal trait meter for the character card. */
export function TraitBar({ name, score, max }: { name: string; score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const tone = pct >= 80 ? "bg-teal" : pct >= 60 ? "bg-gold" : "bg-danger";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <p className="meta-text tabular-nums">
          {score}/{max}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
