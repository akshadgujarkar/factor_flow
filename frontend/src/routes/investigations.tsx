import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel } from "@/components/sentinel/states";
import { AlertCard } from "@/components/sentinel/panels";
import { useSentinel } from "@/store/sentinel";

export const Route = createFileRoute("/investigations")({
  validateSearch: z.object({ case: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Investigations — SentinelAI" },
      { name: "description", content: "Investigations workspace in the SentinelAI market surveillance platform." },
      { property: "og:title", content: "Investigations — SentinelAI" },
      { property: "og:description", content: "Investigations workspace in the SentinelAI market surveillance platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { alerts } = useSentinel();
  const activeCases = alerts
    .filter((a) => a.status !== "Pending")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <AppShell>
      <PageHeader title="Investigations" description="Review ongoing and resolved fraud cases." />
      <Panel title="Active Cases" bodyClassName="p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeCases.length === 0 ? (
            <div className="col-span-full p-8 text-center text-muted-foreground text-sm">
              No active investigations.
            </div>
          ) : (
            activeCases.map((a) => <AlertCard key={a.alert_id} alert={a} />)
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
