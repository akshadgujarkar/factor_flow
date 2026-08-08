import { createFileRoute } from "@tanstack/react-router";
import { Brain, Cpu, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel } from "@/components/sentinel/states";
import { Chip, LiveDot } from "@/components/sentinel/badges";
import { MODELS } from "@/data/mock";
import { useSentinel } from "@/store/sentinel";

export const Route = createFileRoute("/engine")({
  head: () => ({
    meta: [
      { title: "AI Fraud Detection Engine — SentinelAI" },
      {
        name: "description",
        content:
          "Six production ML models covering insider trading, market manipulation, pump and dump, wash trading, spoofing and front running.",
      },
      { property: "og:title", content: "AI Fraud Detection Engine — SentinelAI" },
      { property: "og:description", content: "Model status, confidence and detection counts across the fraud ensemble." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EnginePage,
});

function EnginePage() {
  const { alerts, live } = useSentinel();

  return (
    <AppShell>
      <PageHeader
        title="AI Fraud Detection Engine"
        description="Inference fleet scoring every order event. Models are served by the backend; this console consumes their responses."
        actions={<LiveDot active={live} label={live ? "Inference active" : "Inference paused"} />}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MODELS.map((m, i) => {
          const detections = m.detections + alerts.filter((a) => a.fraud_type === m.name).length;
          return (
            <div
              key={m.id}
              className="panel rise group space-y-3 p-4 transition-colors hover:border-cyan/40"
              style={{ "--rise-delay": `${i * 0.06}s` } as React.CSSProperties}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded bg-primary/12 text-primary">
                    <Brain className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {m.id}
                    </p>
                  </div>
                </div>
                <Chip tone="low">
                  <span className="h-1.5 w-1.5 rounded-full bg-current pulse-dot" />
                  {m.status}
                </Chip>
              </div>

              <p className="text-xs text-muted-foreground">{m.description}</p>

              <div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Model confidence
                  </span>
                  <span className="font-mono text-xs text-cyan">{m.confidence.toFixed(1)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-cyan transition-all duration-1000"
                    style={{ width: `${m.confidence}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-2 font-mono text-[11px] text-muted-foreground">
                <span className="text-foreground">{detections} detections</span>
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3" /> {m.last_scan}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Panel title="Ensemble runtime" subtitle="Serving topology reported by the ML backend" delay={0.3}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: "Inference latency", v: "38 ms p95" },
            { k: "Throughput", v: "18.4k events/s" },
            { k: "Feature store", v: "Online · 214 features" },
            { k: "Drift monitor", v: "PSI 0.04 · stable" },
            { k: "Model registry", v: "v4.2.1 (canary 5%)" },
            { k: "Retrain cadence", v: "Nightly 02:00 UTC" },
            { k: "Explainer", v: "SHAP · per-alert" },
            { k: "Fallback rules", v: "Enabled" },
          ].map((s) => (
            <div key={s.k} className="rounded border border-border bg-background/50 p-3">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <Cpu className="h-3 w-3" /> {s.k}
              </p>
              <p className="mt-1.5 font-mono text-sm text-foreground">{s.v}</p>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
