import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel } from "@/components/sentinel/states";
import { AlertCard } from "@/components/sentinel/panels";
import { useSentinel } from "@/store/sentinel";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — SentinelAI" },
      { name: "description", content: "Alerts workspace in the SentinelAI market surveillance platform." },
      { property: "og:title", content: "Alerts — SentinelAI" },
      { property: "og:description", content: "Alerts workspace in the SentinelAI market surveillance platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { alerts } = useSentinel();
  const pendingAlerts = alerts
    .filter((a) => a.status === "Pending")
    .sort((a, b) => b.risk_score - a.risk_score);

  return (
    <AppShell>
      <PageHeader title="Alerts Workspace" description="Review active suspicious trade alerts requiring triage." />
      <Panel title="Active Alerts" bodyClassName="p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pendingAlerts.length === 0 ? (
            <div className="col-span-full p-8 text-center text-muted-foreground text-sm">
              No pending alerts.
            </div>
          ) : (
            pendingAlerts.map((a) => <AlertCard key={a.alert_id} alert={a} />)
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
