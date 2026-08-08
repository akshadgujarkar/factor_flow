import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Gauge, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel, EmptyState } from "@/components/sentinel/states";
import { FilterPanel } from "@/components/sentinel/panels";
import { RiskScoreBadge, SeverityBadge, LiveDot } from "@/components/sentinel/badges";
import { useSentinel } from "@/store/sentinel";
export const Route = createFileRoute("/risk")({
  head: () => ({
    meta: [
      { title: "Risk Scoring — SentinelAI" },
      {
        name: "description",
        content:
          "Ranked fraud probability and risk scores per trader and instrument, with severity classification and recommended action.",
      },
      { property: "og:title", content: "Risk Scoring — SentinelAI" },
      { property: "og:description", content: "Ranked trader risk scores and fraud probabilities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RiskPage,
});

function RiskPage() {
  const { alerts, live } = useSentinel();
  const navigate = useNavigate();
  const [level, setLevel] = useState("All");
  const [stock, setStock] = useState("All");
  const [trader, setTrader] = useState("All");
  const [window, setWindow] = useState("Last 24 hours");

  const rows = useMemo(
    () =>
      alerts
        .filter((a) => level === "All" || a.severity === level)
        .filter((a) => stock === "All" || a.stock === stock)
        .filter((a) => trader === "All" || a.trader_id === trader)
        .sort((a, b) => b.risk_score - a.risk_score),
    [alerts, level, stock, trader],
  );

  return (
    <AppShell>
      <PageHeader
        title="Risk Scoring Dashboard"
        description="Every scored entity ranked by model-assigned fraud probability. Scores refresh as new order flow arrives."
        actions={<LiveDot active={live} label={live ? "Scores updating" : "Frozen"} />}
      />

      <FilterPanel
        filters={[
          { label: "Risk level", value: level, options: ["All", "Critical", "High", "Medium", "Low"], onChange: setLevel },
          { label: "Date", value: window, options: ["Last 24 hours", "Last 7 days", "Last 30 days", "Quarter to date"], onChange: setWindow },
          { label: "Stock", value: stock, options: ["All", ...Array.from(new Set(alerts.map((a) => a.stock)))], onChange: setStock },
          { label: "Trader", value: trader, options: ["All", ...Array.from(new Set(alerts.map((a) => a.trader_id)))], onChange: setTrader },
        ]}
      >
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {rows.length} scored entities
        </span>
      </FilterPanel>

      <Panel title="Ranked risk register" bodyClassName="p-0" delay={0.1}>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Gauge className="h-6 w-6" />}
              title="No entities match these filters"
              description="Widen the risk level or clear the trader filter to see scored activity."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-normal">Rank</th>
                  <th className="px-4 py-2.5 font-normal">Trader ID</th>
                  <th className="px-4 py-2.5 font-normal">Stock</th>
                  <th className="px-4 py-2.5 font-normal">Fraud type</th>
                  <th className="px-4 py-2.5 font-normal">Fraud probability</th>
                  <th className="px-4 py-2.5 font-normal">Risk score</th>
                  <th className="px-4 py-2.5 font-normal">Severity</th>
                  <th className="px-4 py-2.5 text-right font-normal">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <tr key={a.alert_id} className="border-b border-border/60 transition-colors hover:bg-elevated/50">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{a.trader_id}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-foreground">{a.stock}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">{a.company}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{a.fraud_type}</td>
                    <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-cyan">
                      {a.fraud_probability.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">
                      <RiskScoreBadge score={a.risk_score} />
                    </td>
                    <td className="px-4 py-2.5">
                      <SeverityBadge severity={a.severity} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => navigate({ to: "/explainability", search: { alert: a.alert_id } })}
                        className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/10"
                      >
                        <ShieldAlert className="h-3 w-3" /> Explain
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
