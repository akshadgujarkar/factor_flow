import type { Explainability } from "@/types/sentinel";

/** Horizontal feature-impact bars — the core "why did the model flag this" visual. */
export function FeatureImpactChart({ reasons }: { reasons: Explainability[] }) {
  const max = Math.max(...reasons.map((r) => r.impact), 1);
  return (
    <div className="space-y-3">
      {reasons.map((r, i) => (
        <div key={r.feature} className="rise" style={{ "--rise-delay": `${i * 0.07}s` } as React.CSSProperties}>
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-foreground">{r.feature}</span>
            <span className="font-mono text-xs tabular-nums text-cyan">{r.impact}%</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-sm bg-elevated">
            <div
              className="h-full rounded-sm transition-[width] duration-1000 ease-out"
              style={{
                width: `${(r.impact / max) * 100}%`,
                background:
                  "linear-gradient(90deg, color-mix(in oklch, var(--primary) 85%, transparent), var(--cyan))",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Animated semicircular risk gauge. */
export function RiskGauge({ score, label = "Risk score" }: { score: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const R = 68;
  const CIRC = Math.PI * R;
  const color =
    clamped >= 85 ? "var(--critical)" : clamped >= 65 ? "var(--high)" : clamped >= 40 ? "var(--medium)" : "var(--low)";

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 104" className="w-full max-w-[240px]" role="img" aria-label={`${label} ${clamped}`}>
        <path
          d="M 22 92 A 68 68 0 0 1 158 92"
          fill="none"
          stroke="var(--elevated)"
          strokeWidth={13}
          strokeLinecap="round"
        />
        <path
          d="M 22 92 A 68 68 0 0 1 158 92"
          fill="none"
          stroke={color}
          strokeWidth={13}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC - (clamped / 100) * CIRC}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1), stroke 0.4s" }}
        />
        <text
          x="90"
          y="82"
          textAnchor="middle"
          className="font-mono"
          style={{ fill: color, fontSize: 30, fontWeight: 600 }}
        >
          {clamped}
        </text>
      </svg>
      <p className="-mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    </div>
  );
}
