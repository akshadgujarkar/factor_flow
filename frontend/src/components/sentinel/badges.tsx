import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AlertStatus, Severity } from "@/types/sentinel";

const SEVERITY_STYLES: Record<Severity, string> = {
  Critical: "text-critical border-critical/40 bg-critical/12",
  High: "text-high border-high/40 bg-high/12",
  Medium: "text-medium border-medium/40 bg-medium/12",
  Low: "text-low border-low/40 bg-low/12",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]",
        SEVERITY_STYLES[severity],
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full bg-current", severity === "Critical" && "pulse-dot")}
      />
      {severity}
    </span>
  );
}

export function severityToken(severity: Severity) {
  return {
    Critical: "var(--critical)",
    High: "var(--high)",
    Medium: "var(--medium)",
    Low: "var(--low)",
  }[severity];
}

export function RiskScoreBadge({ score, className }: { score: number; className?: string }) {
  const sev: Severity = score >= 85 ? "Critical" : score >= 65 ? "High" : score >= 40 ? "Medium" : "Low";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: severityToken(sev) }}>
        {score}
      </span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-elevated">
        <span
          className="block h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: severityToken(sev) }}
        />
      </span>
    </span>
  );
}

const STATUS_STYLES: Record<AlertStatus, string> = {
  Pending: "text-medium border-medium/35 bg-medium/10",
  Investigating: "text-cyan border-cyan/35 bg-cyan/10",
  Closed: "text-muted-foreground border-border bg-elevated",
  "Confirmed Fraud": "text-critical border-critical/40 bg-critical/12",
  "False Positive": "text-muted-foreground border-border bg-elevated/50",
  "Under Investigation": "text-cyan border-cyan/35 bg-cyan/10",
  "Escalated": "text-high border-high/40 bg-high/12",
};

export function StatusBadge({ status }: { status: AlertStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        STATUS_STYLES[status],
      )}
    >
      {status}
    </span>
  );
}

export function Chip({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "cyan" | "low" | "critical";
  className?: string;
}) {
  const tones = {
    muted: "text-muted-foreground border-border bg-elevated/60",
    cyan: "text-cyan border-cyan/35 bg-cyan/10",
    low: "text-low border-low/35 bg-low/10",
    critical: "text-critical border-critical/35 bg-critical/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveDot({ label = "Live", active = true }: { label?: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]",
        active ? "text-low" : "text-muted-foreground",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", active && "pulse-dot")} />
      {label}
    </span>
  );
}
