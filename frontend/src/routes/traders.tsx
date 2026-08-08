import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel } from "@/components/sentinel/states";
import { AlertCard } from "@/components/sentinel/panels";
import { useSentinel } from "@/store/sentinel";
import { User, Activity } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/traders")({
  head: () => ({
    meta: [
      { title: "Traders — SentinelAI" },
      { name: "description", content: "Traders workspace in the SentinelAI market surveillance platform." },
      { property: "og:title", content: "Traders — SentinelAI" },
      { property: "og:description", content: "Traders workspace in the SentinelAI market surveillance platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { trades, alerts } = useSentinel();

  // Aggregate stats per trader
  const traderStats = useMemo(() => {
    const map = new Map<string, { id: string; tradeCount: number; alerts: any[] }>();
    
    trades.forEach((t) => {
      if (!map.has(t.trader_id)) map.set(t.trader_id, { id: t.trader_id, tradeCount: 0, alerts: [] });
      map.get(t.trader_id)!.tradeCount += 1;
    });

    alerts.forEach((a) => {
      if (!map.has(a.trader_id)) map.set(a.trader_id, { id: a.trader_id, tradeCount: 0, alerts: [] });
      map.get(a.trader_id)!.alerts.push(a);
    });

    return Array.from(map.values()).sort((a, b) => b.alerts.length - a.alerts.length);
  }, [trades, alerts]);

  return (
    <AppShell>
      <PageHeader title="Trader Directory" description="Entity resolution and aggregated risk profiles." />
      <Panel title="Identified Traders" bodyClassName="p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {traderStats.length === 0 ? (
            <div className="col-span-full p-8 text-center text-muted-foreground text-sm">
              No traders tracked yet.
            </div>
          ) : (
            traderStats.map((t) => {
              const maxRisk = t.alerts.length > 0 ? Math.max(...t.alerts.map(a => a.risk_score)) : 0;
              return (
                <div key={t.id} className="panel p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-elevated grid place-items-center text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold">{t.id}</p>
                      <p className="text-xs text-muted-foreground">{t.tradeCount} trades tracked</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
                    <div className="bg-background/50 rounded p-2 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Alerts</p>
                      <p className="font-mono text-sm text-critical">{t.alerts.length}</p>
                    </div>
                    <div className="bg-background/50 rounded p-2 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Max Risk</p>
                      <p className="font-mono text-sm text-cyan">{maxRisk}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
