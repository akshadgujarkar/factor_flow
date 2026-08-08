import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardMetricCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "default",
  spark,
  delay = 0,
}: {
  label: string;
  value: string;
  delta?: string;
  icon: LucideIcon;
  tone?: "default" | "critical" | "low" | "cyan";
  spark?: number[];
  delay?: number;
}) {
  const tones = {
    default: "text-primary bg-primary/12",
    critical: "text-critical bg-critical/12",
    low: "text-low bg-low/12",
    cyan: "text-cyan bg-cyan/12",
  };
  const stroke = {
    default: "var(--primary)",
    critical: "var(--critical)",
    low: "var(--low)",
    cyan: "var(--cyan)",
  }[tone];

  const path = spark?.length
    ? spark
        .map((v, i) => {
          const max = Math.max(...spark);
          const min = Math.min(...spark);
          const span = max - min || 1;
          const x = (i / (spark.length - 1)) * 100;
          const y = 24 - ((v - min) / span) * 20 - 2;
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")
    : null;

  return (
    <div
      className="panel rise group relative overflow-hidden p-4 transition-colors hover:border-primary/40"
      style={{ "--rise-delay": `${delay}s` } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <span className={cn("grid h-7 w-7 place-items-center rounded", tones[tone])}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        {delta && <p className="text-[11px] text-muted-foreground">{delta}</p>}
        {path && (
          <svg viewBox="0 0 100 24" className="h-6 w-20 shrink-0" preserveAspectRatio="none" aria-hidden>
            <path d={path} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinecap="round" />
          </svg>
        )}
      </div>
    </div>
  );
}
