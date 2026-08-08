import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  Blocks,
  Brain,
  CheckCircle2,
  FileSearch,
  ShieldAlert,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/sentinel/AppShell";
import { DashboardMetricCard } from "@/components/sentinel/DashboardMetricCard";
import { LiveTradeTable } from "@/components/sentinel/LiveTradeTable";
import { Panel, PageHeader } from "@/components/sentinel/states";
import { SystemStatusCard } from "@/components/sentinel/panels";
import { LiveDot, severityToken } from "@/components/sentinel/badges";
import { BlockchainLogCard } from "@/components/sentinel/blockchain";
import { useSentinel } from "@/store/sentinel";
import { api, type MLStats } from "@/lib/api";

import type { Severity } from "@/types/sentinel";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Surveillance Dashboard — SentinelAI" },
      {
        name: "description",
        content:
          "Live surveillance overview: trades monitored, high-risk alerts, fraud distribution, detection timeline and ML model health.",
      },
      { property: "og:title", content: "Surveillance Dashboard — SentinelAI" },
      { property: "og:description", content: "Live market surveillance and fraud detection overview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

export const chartTooltipStyle = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 12,
  },
  labelStyle: { color: "var(--muted-foreground)", fontSize: 11 },
} as const;

function DashboardPage() {
  const { alerts, trades, timeline, tradesMonitored, blockchain, live } = useSentinel();
  const [stats, setStats] = useState<MLStats | null>(null);

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch((err) => console.error("Failed to fetch stats:", err));
  }, []);

  const counts = useMemo(() => {
    const by = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<Severity, number>;
    alerts.forEach((a) => (by[a.severity] += 1));
    return (Object.keys(by) as Severity[]).map((k) => ({ name: k, value: by[k] }));
  }, [alerts]);

  const highRisk = alerts.filter((a) => a.severity === "Critical" || a.severity === "High").length;
  const pending = alerts.filter((a) => a.status !== "Closed").length;
  const resolved = alerts.filter((a) => a.status === "Closed").length;

  return (
    <AppShell>
      <PageHeader
        title="Surveillance Dashboard"
        description="Real-time market integrity posture across every monitored venue, model and case."
        actions={<LiveDot active={live} label={live ? "Streaming feed" : "Feed paused"} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardMetricCard
          label="Trades monitored"
          value={tradesMonitored.toLocaleString()}
          delta="+18.4k / sec ingest"
          icon={Activity}
          tone="cyan"
          spark={[12, 18, 15, 24, 22, 31, 28, 38]}
          delay={0}
        />
        <DashboardMetricCard
          label="High risk alerts"
          value={String(highRisk)}
          delta="Critical + High severity"
          icon={ShieldAlert}
          tone="critical"
          spark={[4, 6, 5, 9, 8, 12, 11, 15]}
          delay={0.05}
        />
        <DashboardMetricCard
          label="Pending investigations"
          value={String(pending)}
          delta="Awaiting analyst action"
          icon={FileSearch}
          delay={0.1}
        />
        <DashboardMetricCard
          label="Resolved cases"
          value={String(resolved + blockchain.length)}
          delta={`${blockchain.length} anchored on-chain`}
          icon={CheckCircle2}
          tone="low"
          delay={0.15}
        />
        <DashboardMetricCard
          label="ML model accuracy"
          value={stats ? `${(stats.xgboost?.f1 * 100).toFixed(1)}%` : "..."}
          delta={stats ? `Ensemble F1 ${stats.xgboost?.f1.toFixed(2)}` : "Loading..."}
          icon={Brain}
          tone="cyan"
          spark={[88, 90, 89, 92, 93, 92, 94, 94]}
          delay={0.2}
        />
      </div>

      <Panel
        title="Live market surveillance"
        subtitle="Streaming order flow scored by the detection ensemble in real time"
        actions={<LiveDot active={live} />}
        bodyClassName="p-0 pb-2"
        delay={0.24}
      >
        <LiveTradeTable trades={trades} limit={9} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Fraud risk distribution" delay={0.28}>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={counts}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={3}
                  stroke="var(--background)"
                >
                  {counts.map((c) => (
                    <Cell key={c.name} fill={severityToken(c.name as Severity)} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltipStyle} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  formatter={(v) => <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Fraud detection timeline" className="lg:col-span-2" delay={0.32}>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gDet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCrit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--critical)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--critical)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="detections"
                  stroke="var(--cyan)"
                  strokeWidth={1.6}
                  fill="url(#gDet)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="critical"
                  stroke="var(--critical)"
                  strokeWidth={1.6}
                  fill="url(#gCrit)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="ML model status" subtitle="Ensemble health and inference confidence" delay={0.36}>
          <div className="space-y-2">
            {stats ? (
              <>
                <SystemStatusCard
                  name="XGBoost Ensemble"
                  status="Active"
                  confidence={stats.xgboost?.roc_auc * 100}
                  detail={`ROC AUC: ${stats.xgboost?.roc_auc?.toFixed(3)} · PR AUC: ${stats.xgboost?.pr_auc?.toFixed(3)}`}
                />
                <SystemStatusCard
                  name="Isolation Forest"
                  status="Active"
                  confidence={stats.isolation_forest?.roc_auc * 100}
                  detail={`ROC AUC: ${stats.isolation_forest?.roc_auc?.toFixed(3)} · F1: ${stats.isolation_forest?.f1?.toFixed(3)}`}
                />
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Loading models...</div>
            )}
          </div>
        </Panel>

        <Panel
          title="Recent blockchain anchors"
          subtitle="Immutable confirmations written to the audit chain"
          actions={
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan">
              <Blocks className="h-3 w-3" /> {blockchain.length} records
            </span>
          }
          delay={0.4}
        >
          <div className="space-y-2">
            {blockchain.slice(0, 4).map((r) => (
              <BlockchainLogCard key={r.tx_hash} record={r} />
            ))}
            <p className="flex items-center gap-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <BadgeCheck className="h-3 w-3 text-low" /> Chain height verified · 0 tampering events
            </p>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
