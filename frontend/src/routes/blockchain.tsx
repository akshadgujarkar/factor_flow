import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel } from "@/components/sentinel/states";
import { BlockchainLogCard } from "@/components/sentinel/blockchain";
import { useSentinel } from "@/store/sentinel";

export const Route = createFileRoute("/blockchain")({
  head: () => ({
    meta: [
      { title: "Blockchain — SentinelAI" },
      { name: "description", content: "Blockchain workspace in the SentinelAI market surveillance platform." },
      { property: "og:title", content: "Blockchain — SentinelAI" },
      { property: "og:description", content: "Blockchain workspace in the SentinelAI market surveillance platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { blockchain } = useSentinel();
  return (
    <AppShell>
      <PageHeader title="Blockchain" description="Blockchain workspace." />
      <Panel title="Blockchain">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {blockchain.map((r) => (
            <BlockchainLogCard key={r.tx_hash} record={r} />
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
