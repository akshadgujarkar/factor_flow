import { NETWORK } from "@/data/mock";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/types/sentinel";

const NODE_STYLE: Record<string, { fill: string; label: string }> = {
  trader: { fill: "var(--critical)", label: "Trader" },
  employee: { fill: "var(--high)", label: "Company insider" },
  broker: { fill: "var(--primary)", label: "Broker" },
  account: { fill: "var(--cyan)", label: "Related account" },
};

/** Relationship graph placeholder — swap positions for backend graph coordinates. */
export function NetworkGraph() {
  const byId = Object.fromEntries(NETWORK.nodes.map((n) => [n.id, n]));

  return (
    <div className="relative">
      <svg viewBox="0 0 100 100" className="grid-backdrop h-[300px] w-full rounded border border-border bg-background/40">
        {NETWORK.edges.map((e) => {
          const a = byId[e.from]!;
          const b = byId[e.to]!;
          return (
            <g key={`${e.from}-${e.to}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--cyan)"
                strokeOpacity={0.15 + e.weight * 0.5}
                strokeWidth={0.3 + e.weight * 0.8}
              />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 1}
                textAnchor="middle"
                style={{ fill: "var(--muted-foreground)", fontSize: 2.2 }}
                className="font-mono"
              >
                {e.label}
              </text>
            </g>
          );
        })}
        {NETWORK.nodes.map((n) => (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.type === "trader" ? 4 : 2.8}
              fill={NODE_STYLE[n.type]!.fill}
              fillOpacity={0.9}
            />
            <circle
              cx={n.x}
              cy={n.y}
              r={n.type === "trader" ? 7 : 5}
              fill="none"
              stroke={NODE_STYLE[n.type]!.fill}
              strokeOpacity={0.35}
              strokeWidth={0.4}
            />
            <text
              x={n.x}
              y={n.y + (n.type === "trader" ? 10 : 8)}
              textAnchor="middle"
              style={{ fill: "var(--foreground)", fontSize: 2.6 }}
              className="font-mono"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-3">
        {Object.entries(NODE_STYLE).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: v.fill }} />
            {v.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const KIND_COLOR: Record<TimelineEvent["kind"], string> = {
  trade: "var(--primary)",
  comm: "var(--high)",
  market: "var(--cyan)",
  system: "var(--critical)",
  ai: "var(--medium)",
};

export function InvestigationTimeline({
  events,
  className,
}: {
  events: TimelineEvent[];
  className?: string;
}) {
  return (
    <ol className={cn("relative space-y-4 border-l border-border pl-5", className)}>
      {events.map((e, i) => (
        <li
          key={e.id}
          className="rise relative"
          style={{ "--rise-delay": `${i * 0.06}s` } as React.CSSProperties}
        >
          <span
            className="absolute -left-[26px] top-1 grid h-3 w-3 place-items-center rounded-full border-2 border-background"
            style={{ background: KIND_COLOR[e.kind] }}
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {e.time}
          </p>
          <p className="text-[13px] font-medium text-foreground">{e.label}</p>
          <p className="text-xs text-muted-foreground">{e.detail}</p>
        </li>
      ))}
    </ol>
  );
}
