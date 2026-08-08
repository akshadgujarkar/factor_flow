import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel } from "@/components/sentinel/states";
import { AlertCard } from "@/components/sentinel/panels";
import { useSentinel } from "@/store/sentinel";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SentinelAI" },
      { name: "description", content: "Settings workspace in the SentinelAI market surveillance platform." },
      { property: "og:title", content: "Settings — SentinelAI" },
      { property: "og:description", content: "Settings workspace in the SentinelAI market surveillance platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { alerts } = useSentinel();
  return (
    <AppShell>
      <PageHeader title="Settings" description="Settings workspace." />
      <Panel title="Settings">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {alerts.slice(0, 9).map((a) => (
            <AlertCard key={a.alert_id} alert={a} />
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
