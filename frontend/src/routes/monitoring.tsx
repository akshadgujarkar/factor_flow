import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Database, Loader2, Radio, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel } from "@/components/sentinel/states";
import { LiveTradeTable } from "@/components/sentinel/LiveTradeTable";
import { Chip, LiveDot } from "@/components/sentinel/badges";
import { useSentinel } from "@/store/sentinel";
import { useDataSources } from "@/hooks/useDataSources";

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
  Connected:  "low",
  Processing: "cyan",
  Failed:     "critical",
} as const;

/** Format a raw record count into a compact string, e.g. 110000 → "110k" */
function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

/** Format an ISO timestamp to a short local date-time string */
function fmtUpdated(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

// ── Skeleton card shown while loading ──────────────────────────────────
function SourceCardSkeleton() {
  return (
    <div className="panel space-y-3 p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded bg-elevated" />
          <span className="h-4 w-28 rounded bg-elevated" />
        </div>
        <span className="h-5 w-20 rounded-full bg-elevated" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="h-4 w-16 rounded bg-elevated" />
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="h-3 w-24 rounded bg-elevated" />
        <span className="h-3 w-16 rounded bg-elevated" />
      </div>
    </div>
  );
}

// ── Error banner ────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        <strong>Backend unreachable:</strong> {message}. Data source cards require the
        FastAPI backend at <code className="font-mono text-xs">localhost:8000</code>.
      </span>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 rounded border border-red-500/40 px-2 py-1 text-xs hover:bg-red-500/20 transition-colors"
      >
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    </div>
  );
}

function MonitoringPage() {
  const { trades, live } = useSentinel();
  const { sources, loading, error, refetch } = useDataSources();

  return (
    <AppShell>
      <PageHeader
        title="Data Collection Monitoring"
        description="Every upstream feed powering the detection ensemble, with connection state, throughput and schema — live from the ML backend."
        actions={
          <div className="flex items-center gap-3">
            {!loading && !error && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Live · polling 3s
              </span>
            )}
            {loading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan" />
            )}
            <LiveDot active={live} label={live ? "Ingesting" : "Paused"} />
          </div>
        }
      />

      {/* ── Error banner ── */}
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* ── Data source cards ── */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SourceCardSkeleton key={i} />)
          : sources.map((ds, i) => (
              <div
                key={ds.id}
                className="panel rise space-y-3 p-4 transition-colors hover:border-primary/40"
                style={{ "--rise-delay": `${i * 0.06}s` } as React.CSSProperties}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded bg-elevated text-cyan">
                      <Database className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{ds.name}</p>
                      {ds.record_count != null && (
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {fmtCount(ds.record_count)} records
                        </p>
                      )}
                    </div>
                  </div>
                  <Chip tone={STATUS_TONE[ds.status] ?? "low"}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current pulse-dot" />
                    {ds.status}
                  </Chip>
                </div>

                {/* Field chips */}
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

                {/* Footer metrics */}
                <div className="space-y-1 border-t border-border pt-2">
                  <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span>Throughput {ds.throughput}</span>
                    <span>Latency {ds.latency}</span>
                  </div>
                  {ds.last_updated && (
                    <p className="font-mono text-[10px] text-muted-foreground/60">
                      Updated {fmtUpdated(ds.last_updated)}
                    </p>
                  )}
                </div>
              </div>
            ))}
      </div>

      {/* ── Live trade tape ── */}
      <Panel
        title="Live trade tape"
        subtitle="Raw normalised trade events as consumed by the scoring service — streamed from the ML backend WebSocket"
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
