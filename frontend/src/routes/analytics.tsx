import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel } from "@/components/sentinel/states";
import { useSentinel } from "@/store/sentinel";
import { useMemo, useState, useEffect } from "react";
import { api, type MLStats } from "@/lib/api";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { severityToken } from "@/components/sentinel/badges";
import { chartTooltipStyle } from "@/routes/dashboard";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — SentinelAI" },
      { name: "description", content: "Analytics workspace in the SentinelAI market surveillance platform." },
    ],
  }),
  component: Page,
});

function Page() {
  const { alerts } = useSentinel();
  const [stats, setStats] = useState<MLStats | null>(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
  }, []);

  const fraudDistribution = useMemo(() => {
    const by = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<string, number>;
    alerts.forEach((a) => {
      if (by[a.severity] !== undefined) by[a.severity]! += 1;
    });
    return Object.keys(by).map((k) => ({ name: k, value: by[k] }));
  }, [alerts]);

  const topStocks = useMemo(() => {
    const map = new Map<string, number>();
    alerts.forEach((a) => {
      map.set(a.stock, (map.get(a.stock) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [alerts]);

  return (
    <AppShell>
      <PageHeader title="Analytics Hub" description="Deep dive into detection trends and model confidence metrics." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Fraud Risk Distribution" bodyClassName="p-4">
          <div className="h-[240px]">
            {alerts.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fraudDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {fraudDistribution.map((entry) => (
                      <Cell key={entry.name} fill={severityToken(entry.name as any)} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="Top Suspicious Stocks" bodyClassName="p-4">
          <div className="h-[240px]">
            {topStocks.length === 0 ? (
               <div className="grid h-full place-items-center text-sm text-muted-foreground">No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topStocks}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...chartTooltipStyle} />
                  <Bar dataKey="count" fill="var(--critical)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="XGBoost Ensemble Stats" bodyClassName="p-4">
          {stats ? (
            <div className="space-y-3">
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground">F1 Score</span>
                <span className="font-mono text-cyan">{stats.xgboost.f1.toFixed(3)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground">ROC AUC</span>
                <span className="font-mono text-cyan">{stats.xgboost.roc_auc.toFixed(3)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground">Precision</span>
                <span className="font-mono text-cyan">{stats.xgboost.precision.toFixed(3)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground">Recall</span>
                <span className="font-mono text-cyan">{stats.xgboost.recall.toFixed(3)}</span>
              </div>
            </div>
          ) : (
             <div className="text-sm text-muted-foreground">Loading ML Stats...</div>
          )}
        </Panel>

        <Panel title="Isolation Forest Stats" bodyClassName="p-4">
          {stats ? (
            <div className="space-y-3">
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground">F1 Score</span>
                <span className="font-mono text-cyan">{stats.isolation_forest.f1.toFixed(3)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground">ROC AUC</span>
                <span className="font-mono text-cyan">{stats.isolation_forest.roc_auc.toFixed(3)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground">PR AUC</span>
                <span className="font-mono text-cyan">{stats.isolation_forest.pr_auc.toFixed(3)}</span>
              </div>
            </div>
          ) : (
             <div className="text-sm text-muted-foreground">Loading ML Stats...</div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
