import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel } from "@/components/sentinel/states";
import { AlertCard } from "@/components/sentinel/panels";
import { useSentinel } from "@/store/sentinel";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — SentinelAI" },
      { name: "description", content: "Reports workspace in the SentinelAI market surveillance platform." },
      { property: "og:title", content: "Reports — SentinelAI" },
      { property: "og:description", content: "Reports workspace in the SentinelAI market surveillance platform." },
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
      <PageHeader title="Reports" description="Reports workspace." />
      <Panel title="Reports">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {alerts.slice(0, 9).map((a) => (
            <AlertCard key={a.alert_id} alert={a} />
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
