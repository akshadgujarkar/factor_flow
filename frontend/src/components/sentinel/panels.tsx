import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Cpu, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types/sentinel";
import { RiskScoreBadge, SeverityBadge, StatusBadge } from "./badges";
import { AnchoredBadge } from "./blockchain";

export function FilterPanel({
  filters,
  children,
}: {
  filters: {
    label: string;
    value: string;
    options: string[];
    onChange: (v: string) => void;
  }[];
  children?: ReactNode;
}) {
  return (
    <div className="panel flex flex-wrap items-end gap-3 p-3">
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <Filter className="h-3 w-3" /> Filters
      </span>
      {filters.map((f) => (
        <label key={f.label} className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {f.label}
          </span>
          <select
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
          >
            {f.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      ))}
      {children}
    </div>
  );
}

export function SystemStatusCard({
  name,
  status,
  confidence,
  detail,
}: {
  name: string;
  status: "Active" | "Training" | "Idle" | "Connected" | "Processing" | "Failed";
  confidence?: number;
  detail?: string;
}) {
  const tone =
    status === "Failed" ? "critical" : status === "Processing" || status === "Training" ? "medium" : "low";
  const color = { critical: "var(--critical)", medium: "var(--medium)", low: "var(--low)" }[tone];

  return (
    <div className="panel flex items-center gap-3 p-3">
      <span className="grid h-8 w-8 place-items-center rounded bg-elevated text-muted-foreground">
        <Cpu className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-foreground">{name}</p>
        {detail && <p className="truncate text-[11px] text-muted-foreground">{detail}</p>}
      </div>
      {confidence !== undefined && (
        <span className="font-mono text-xs tabular-nums text-cyan">{confidence.toFixed(1)}%</span>
      )}
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full pulse-dot" style={{ background: color, color }} />
        {status}
      </span>
    </div>
  );
}

export function AlertCard({ alert, className }: { alert: Alert; className?: string }) {
  return (
    <div className={cn("panel space-y-2.5 p-3.5 transition-colors hover:border-primary/40", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-cyan">{alert.alert_id}</p>
          <p className="text-[13px] text-foreground">
            {alert.fraud_type} · <span className="font-mono">{alert.stock}</span>
          </p>
        </div>
        <SeverityBadge severity={alert.severity} />
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{alert.reason}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RiskScoreBadge score={alert.risk_score} />
        <StatusBadge status={alert.status} />
      </div>
      {alert.tx_hash && <AnchoredBadge hash={alert.tx_hash} />}
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {alert.trader_id} · {alert.assigned_to}
        </span>
        <Link
          to="/investigations"
          search={{ case: alert.case_id }}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:underline"
        >
          Open case →
        </Link>
      </div>
    </div>
  );
}
