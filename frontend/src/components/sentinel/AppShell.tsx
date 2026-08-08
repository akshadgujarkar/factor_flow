import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  Blocks,
  Brain,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Radar,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Moon,
  Users,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSentinel } from "@/store/sentinel";
import { Chip, LiveDot } from "./badges";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/monitoring", label: "Live Market Monitoring", icon: Radar },
  { to: "/engine", label: "AI Detection Engine", icon: Brain },
  { to: "/risk", label: "Risk Scoring", icon: Gauge },
  { to: "/explainability", label: "Explainable AI", icon: Waypoints },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/investigations", label: "Investigations", icon: ShieldAlert },
  { to: "/traders", label: "Traders", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/blockchain", label: "Blockchain Audit Log", icon: Blocks },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, hydrated, logout, alerts, live, setLive, blockchain, theme, toggleTheme } = useSentinel();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !user) navigate({ to: "/", replace: true });
  }, [hydrated, user, navigate]);

  useEffect(() => setOpen(false), [pathname]);

  const pending = alerts.filter((a) => a.status === "Pending").length;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-sidebar transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
          <span className="grid h-8 w-8 place-items-center rounded bg-primary/15 text-primary">
            <Activity className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-foreground">SentinelAI</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Surveillance Suite
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-elevated hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
                  strokeWidth={2}
                />
                <span className="truncate">{item.label}</span>
                {item.to === "/alerts" && pending > 0 && (
                  <span className="ml-auto rounded-full bg-critical/20 px-1.5 font-mono text-[10px] text-critical">
                    {pending}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border p-3">
          <div className="flex items-center justify-between rounded border border-border bg-elevated/50 px-2.5 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Chain
            </span>
            <Chip tone="low">
              <span className="h-1.5 w-1.5 rounded-full bg-current pulse-dot" />
              Synced · {blockchain.length}
            </Chip>
          </div>
          <button
            onClick={() => setLive(!live)}
            className="flex w-full items-center justify-between rounded border border-border px-2.5 py-2 text-left transition-colors hover:bg-elevated"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Demo feed
            </span>
            <LiveDot active={live} label={live ? "Streaming" : "Paused"} />
          </button>
        </div>
      </aside>

      {open && (
        <button
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-background/70 lg:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Navbar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
          <button
            onClick={() => setOpen(true)}
            className="rounded border border-border p-1.5 text-muted-foreground lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          <label className="relative hidden min-w-0 flex-1 max-w-sm items-center md:flex">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              placeholder="Search traders, cases, symbols…"
              className="w-full rounded border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            />
          </label>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline font-mono text-[11px]">Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="hidden sm:inline font-mono text-[11px]">Dark</span>
                </>
              )}
            </button>

            <Chip tone="cyan">
              <Blocks className="h-3 w-3" /> Chain OK
            </Chip>
            <div className="relative">
              <Bell className="h-4 w-4 text-muted-foreground" />
              {pending > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-critical px-1 font-mono text-[9px] text-background">
                  {pending}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 border-l border-border pl-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-foreground">{user?.name ?? "—"}</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-primary">
                  {user?.role ?? "Guest"}
                </p>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-elevated font-mono text-[11px] text-foreground">
                {(user?.name ?? "S").slice(0, 1).toUpperCase()}
              </span>
              <button
                onClick={() => {
                  logout();
                  navigate({ to: "/", replace: true });
                }}
                aria-label="Sign out"
                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 space-y-6 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
