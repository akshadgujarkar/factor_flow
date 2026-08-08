import { createFileRoute } from "@tanstack/react-router";
import { Database, Radio } from "lucide-react";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel } from "@/components/sentinel/states";
import { LiveTradeTable } from "@/components/sentinel/LiveTradeTable";
import { Chip, LiveDot } from "@/components/sentinel/badges";
import { useSentinel } from "@/store/sentinel";
import { DATA_SOURCES } from "@/data/mock";

export const Route = createFileRoute("/monitoring")({
  head: () => ({
    meta: [
      { title: "Live Market Monitoring — SentinelAI" },
      {
        name: "description",
        content:
          "Data collection health across trading, market, communication metadata, company and historical fraud feeds, plus the live trade tape.",
      },
      { property: "og:title", content: "Live Market Monitoring — SentinelAI" },
      { property: "og:description", content: "Streaming data ingestion health and live trade tape." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MonitoringPage,
});

const STATUS_TONE = {
  Connected: "low",
  Processing: "cyan",
  Failed: "critical",
} as const;

function MonitoringPage() {
  const { trades, live } = useSentinel();

  return (
    <AppShell>
      <PageHeader
        title="Data Collection Monitoring"
        description="Every upstream feed powering the detection ensemble, with connection state, throughput and schema."
        actions={<LiveDot active={live} label={live ? "Ingesting" : "Paused"} />}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {DATA_SOURCES.map((ds, i) => (
          <div
            key={ds.id}
            className="panel rise space-y-3 p-4 transition-colors hover:border-primary/40"
            style={{ "--rise-delay": `${i * 0.06}s` } as React.CSSProperties}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded bg-elevated text-cyan">
                  <Database className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium text-foreground">{ds.name}</p>
              </div>
              <Chip tone={STATUS_TONE[ds.status]}>
                <span className="h-1.5 w-1.5 rounded-full bg-current pulse-dot" />
                {ds.status}
              </Chip>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {ds.fields.map((f) => (
                <span
                  key={f}
                  className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  {f}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2 font-mono text-[11px] text-muted-foreground">
              <span>Throughput {ds.throughput}</span>
              <span>Latency {ds.latency}</span>
            </div>
          </div>
        ))}
      </div>

      <Panel
        title="Live trade tape"
        subtitle="Raw normalised trade events as consumed by the scoring service"
        actions={
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan">
            <Radio className="h-3 w-3" /> {trades.length} buffered
          </span>
        }
        bodyClassName="p-0 pb-2"
        delay={0.24}
      >
        <LiveTradeTable trades={trades} limit={16} />
      </Panel>
    </AppShell>
  );
}
