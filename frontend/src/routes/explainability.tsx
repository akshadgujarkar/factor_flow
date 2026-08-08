import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Blocks } from "lucide-react";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel, KeyValue } from "@/components/sentinel/states";
import { FeatureImpactChart, RiskGauge } from "@/components/sentinel/FeatureImpactChart";
import { NetworkGraph, InvestigationTimeline } from "@/components/sentinel/NetworkGraph";
import { SeverityBadge, LiveDot } from "@/components/sentinel/badges";
import { AnchorFraudDialog, AnchoredBadge } from "@/components/sentinel/blockchain";
import { useSentinel } from "@/store/sentinel";
import { api } from "@/lib/api";

export const Route = createFileRoute("/explainability")({
  validateSearch: z.object({ alert: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Explainable AI — SentinelAI" },
      {
        name: "description",
        content:
          "Why the model flagged this case: feature impact, suspicious event timeline, relationship network and an animated risk gauge.",
      },
      { property: "og:title", content: "Explainable AI — SentinelAI" },
      { property: "og:description", content: "Feature-level explanations behind every fraud alert." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XaiPage,
});

function XaiPage() {
  const { alert: alertId } = Route.useSearch();
  const { alerts, live } = useSentinel();
  const [dialog, setDialog] = useState(false);

  const sorted = [...alerts].sort((a, b) => b.risk_score - a.risk_score);
  const alert = alerts.find((a) => a.alert_id === alertId) ?? sorted[0];
  const [reasons, setReasons] = useState<any[]>(alert?.top_reasons || []);

  useEffect(() => {
    if (!alert) return;
    
    const fetchShap = async () => {
      try {
        const data = await api.predictTrade({
          trade_id: alert.alert_id,
          trader_id: alert.trader_id,
          ticker: alert.stock,
          action: "SELL",
          quantity: 1500,
          price: 150.0
        });
        if (data.shap_values) {
          const formatted = data.shap_values.map((s: any) => ({
            feature: s.feature,
            impact: s.value
          }));
          setReasons(formatted);
        }
      } catch (err) {
        console.error("Failed to fetch SHAP values", err);
      }
    };
    
    fetchShap();
  }, [alert]);

  if (!alert) return null;

  return (
    <AppShell>
      <PageHeader
        title="Explainable AI"
        description="Every score is decomposed into human-readable evidence so an investigator can defend the decision to a regulator."
        actions={<LiveDot active={live} label={live ? "Explainer online" : "Paused"} />}
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Panel title="Alert summary">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-cyan">{alert.alert_id}</span>
                <SeverityBadge severity={alert.severity} />
              </div>
              <RiskGauge score={alert.risk_score} />
              <div className="rounded border border-border bg-background/40 px-3 py-1">
                <KeyValue label="Trader" value={<span className="font-mono">{alert.trader_id}</span>} />
                <KeyValue label="Stock" value={<span className="font-mono">{alert.stock}</span>} />
                <KeyValue label="Fraud type" value={alert.fraud_type} />
                <KeyValue
                  label="Probability"
                  value={<span className="font-mono">{alert.fraud_probability.toFixed(2)}</span>}
                />
                <KeyValue
                  label="Anomaly score"
                  value={<span className="font-mono">{alert.anomaly_score.toFixed(2)}</span>}
                />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{alert.reason}</p>
              {alert.tx_hash ? (
                <AnchoredBadge hash={alert.tx_hash} />
              ) : (
                <button
                  onClick={() => setDialog(true)}
                  className="flex w-full items-center justify-center gap-2 rounded bg-primary py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  <Blocks className="h-3.5 w-3.5" /> Anchor confirmed fraud
                </button>
              )}
            </div>
          </Panel>

          <Panel title="Other flagged cases" bodyClassName="p-2">
            <div className="max-h-[280px] space-y-1 overflow-y-auto">
              {sorted.slice(0, 10).map((a) => (
                <a
                  key={a.alert_id}
                  href={`/explainability?alert=${a.alert_id}`}
                  className={`flex items-center justify-between rounded px-2.5 py-2 text-xs transition-colors hover:bg-elevated ${
                    a.alert_id === alert.alert_id ? "bg-primary/12 text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span className="font-mono">{a.alert_id}</span>
                  <span className="font-mono">{a.stock}</span>
                  <span className="font-mono">{a.risk_score}</span>
                </a>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Feature impact" subtitle="Contribution of each signal to the final fraud probability">
            <FeatureImpactChart reasons={reasons} />
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Timeline of suspicious events">
              <InvestigationTimeline events={[]} />
            </Panel>
            <Panel title="Relationship network" subtitle="Trader, insider, broker and related accounts">
              <NetworkGraph />
            </Panel>
          </div>
        </div>
      </div>

      <AnchorFraudDialog alert={alert} open={dialog} onOpenChange={setDialog} trigger="Explainable AI review" />
    </AppShell>
  );
}
