import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, Blocks, Brain, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useSentinel } from "@/store/sentinel";
import type { UserRole } from "@/types/sentinel";
import { LiveDot } from "@/components/sentinel/badges";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — SentinelAI Surveillance Platform" },
      {
        name: "description",
        content:
          "Secure access to SentinelAI: ML-based insider trading and fraud detection for market surveillance teams.",
      },
      { property: "og:title", content: "Sign in — SentinelAI Surveillance Platform" },
      {
        property: "og:description",
        content: "Secure access to SentinelAI market surveillance and fraud detection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

const ROLES: UserRole[] = ["Investigator", "Compliance Officer", "Admin"];

function LoginPage() {
  const { login, user, hydrated } = useSentinel();
  const navigate = useNavigate();
  const [email, setEmail] = useState("a.raghavan@sentinel.ai");
  const [password, setPassword] = useState("demo-access");
  const [role, setRole] = useState<UserRole>("Investigator");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && user) navigate({ to: "/dashboard", replace: true });
  }, [hydrated, user, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => {
      login(email, role);
      navigate({ to: "/dashboard" });
    }, 700);
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left: surveillance illustration */}
      <section className="relative hidden overflow-hidden border-r border-border bg-background lg:block">
        <div className="grid-backdrop absolute inset-0 opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_60%)]" />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          {[
            [20, 30, 50, 50],
            [50, 50, 78, 26],
            [50, 50, 30, 74],
            [50, 50, 82, 72],
            [78, 26, 82, 72],
            [20, 30, 30, 74],
          ].map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--cyan)"
              strokeOpacity={0.35}
              strokeWidth={0.25}
            />
          ))}
          {[
            [50, 50, 2.4, "var(--critical)"],
            [20, 30, 1.4, "var(--cyan)"],
            [78, 26, 1.4, "var(--primary)"],
            [30, 74, 1.4, "var(--cyan)"],
            [82, 72, 1.4, "var(--primary)"],
          ].map(([cx, cy, r, fill], i) => (
            <circle key={i} cx={cx as number} cy={cy as number} r={r as number} fill={fill as string} />
          ))}
        </svg>

        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded bg-primary/15 text-primary">
              <Activity className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div>
              <p className="font-semibold tracking-tight text-foreground">SentinelAI</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Market Surveillance
              </p>
            </div>
          </div>

          <div className="max-w-md space-y-4">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">
              Detect insider trading before the market does.
            </h2>
            <p className="text-sm text-muted-foreground">
              Streaming order-flow surveillance, six ML fraud models, explainable risk scoring and
              tamper-proof blockchain case anchoring — in one regulator-grade console.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              {[
                { icon: Brain, label: "6 live ML models" },
                { icon: ShieldCheck, label: "Explainable AI" },
                { icon: Blocks, label: "Immutable audit" },
              ].map((f) => (
                <span
                  key={f.label}
                  className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan"
                >
                  <f.icon className="h-3.5 w-3.5" /> {f.label}
                </span>
              ))}
            </div>
          </div>

          <LiveDot label="Surveillance grid online · 18.4k msg/s" />
        </div>
      </section>

      {/* Right: login card */}
      <section className="flex items-center justify-center bg-surface/40 px-6 py-12">
        <form onSubmit={submit} className="panel rise w-full max-w-sm space-y-5 p-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded bg-primary/15 text-primary">
              <Activity className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <p className="font-semibold tracking-tight text-foreground">SentinelAI</p>
          </div>

          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Secure sign in</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Authorised surveillance personnel only. All sessions are audit logged.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Email
            </span>
            <span className="relative flex items-center">
              <Mail className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground focus:border-primary/60 focus:outline-none"
              />
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Password
            </span>
            <span className="relative flex items-center">
              <Lock className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground focus:border-primary/60 focus:outline-none"
              />
            </span>
          </label>

          <div className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Role
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded border px-2 py-2 text-[11px] transition-colors ${
                    role === r
                      ? "border-primary/60 bg-primary/15 text-foreground"
                      : "border-border text-muted-foreground hover:bg-elevated"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-70"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? "Authenticating…" : "Sign in to console"}
          </button>

          <p className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Demo environment · no credentials verified
          </p>
        </form>
      </section>
    </main>
  );
}
