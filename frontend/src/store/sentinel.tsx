import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Alert,
  AuthUser,
  BlockchainRecord,
  LeaderboardEntry,
  LeaderboardEvent,
  Trade,
  UserRole,
  Severity,
} from "@/types/sentinel";
import { BASE_TIME, makeRng, makeTxHash, severityFor } from "@/data/mock";

export interface TimelinePoint {
  t: string;
  detections: number;
  critical: number;
}

interface SentinelState {
  hydrated: boolean;
  user: AuthUser | null;
  login: (email: string, role: UserRole) => void;
  logout: () => void;

  live: boolean;
  setLive: (v: boolean) => void;

  trades: Trade[];
  alerts: Alert[];
  blockchain: BlockchainRecord[];
  timeline: TimelinePoint[];
  cases: Alert[];
  fetchCases: () => Promise<void>;
  tradesMonitored: number;
  autoAnchorThreshold: number;
  setAutoAnchorThreshold: (v: number) => void;

  /** Real-time Top-80 leaderboard sorted by risk_score desc */
  leaderboard: LeaderboardEntry[];
  lastLeaderboardEvent: LeaderboardEvent | null;

  anchorCase: (alert: Alert, reason?: string) => BlockchainRecord;
  updateAlert: (id: string, patch: Partial<Alert>) => void;
  updateCaseStatus: (caseId: string, status: string, note?: string) => Promise<void>;
  anchorCaseToBlockchain: (caseId: string) => Promise<void>;
}

const Ctx = createContext<SentinelState | null>(null);

function seedTimeline(): TimelinePoint[] {
  const rng = makeRng(4242);
  return Array.from({ length: 16 }, (_, i) => {
    const at = new Date(BASE_TIME - (16 - i) * 900_000);
    return {
      t: at.toISOString().slice(11, 16),
      detections: 8 + Math.round(rng() * 26),
      critical: 1 + Math.round(rng() * 7),
    };
  });
}

export function SentinelProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [live, setLive] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [blockchain, setBlockchain] = useState<BlockchainRecord[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [tradesMonitored, setTradesMonitored] = useState(1_284_930);
  const [autoAnchorThreshold, setAutoAnchorThreshold] = useState(78);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lastLeaderboardEvent, setLastLeaderboardEvent] = useState<LeaderboardEvent | null>(null);
  const [cases, setCases] = useState<Alert[]>([]);

  const fetchCases = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8000/api/investigations");
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      }
    } catch (e) {
      console.error("Failed to fetch cases:", e);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    const t = setInterval(fetchCases, 3000);
    return () => clearInterval(t);
  }, [fetchCases]);

  const updateCaseStatus = useCallback(async (caseId: string, status: string, note?: string) => {
    try {
      await fetch(`http://localhost:8000/api/investigations/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      fetchCases();
    } catch (e) {
      console.error("Failed to update case:", e);
    }
  }, [fetchCases]);

  const anchorCaseToBlockchain = useCallback(async (caseId: string) => {
    try {
      await fetch(`http://localhost:8000/api/investigations/${caseId}/blockchain`, {
        method: "POST",
      });
      fetchCases();
    } catch (e) {
      console.error("Failed to anchor case:", e);
    }
  }, [fetchCases]);

  const rng = useRef(makeRng(Date.now() % 100000)).current;
  const counter = useRef(400);

  useEffect(() => {
    setHydrated(true);
    try {
      const raw = localStorage.getItem("sentinel-user");
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {
      /* ignore */
    }
  }, []);

  const login = useCallback((email: string, role: UserRole) => {
    const name = email.split("@")[0]?.replace(/[._]/g, " ") || "Analyst";
    const u: AuthUser = {
      email,
      role,
      name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    };
    setUser(u);
    try {
      localStorage.setItem("sentinel-user", JSON.stringify(u));
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem("sentinel-user");
    } catch {
      /* ignore */
    }
  }, []);

  const updateAlert = useCallback((id: string, patch: Partial<Alert>) => {
    setAlerts((prev) => prev.map((a) => (a.alert_id === id ? { ...a, ...patch } : a)));
  }, []);

  const anchorCase = useCallback(
    (alert: Alert, reason?: string) => {
      const record: BlockchainRecord = {
        tx_hash: makeTxHash(),
        case_id: alert.case_id,
        trader_id: alert.trader_id,
        stock: alert.stock,
        fraud_type: alert.fraud_type,
        confidence: Math.round(alert.fraud_probability * 100),
        timestamp: new Date().toISOString(),
        anchored: true,
        confirmed_by: user?.name ?? "SentinelAI Engine",
        confirmed_role: user?.role ?? "System",
        reason: reason ?? alert.reason,
        block: 8_412_004 + blockchain.length,
      };
      setBlockchain((prev) => [record, ...prev]);
      setAlerts((prev) =>
        prev.map((a) =>
          a.alert_id === alert.alert_id
            ? { ...a, anchored: true, tx_hash: record.tx_hash, status: "Closed" }
            : a,
        ),
      );
      return record;
    },
    [blockchain.length, user],
  );

  // ── Leaderboard WebSocket (/ws/leaderboard) ────────────────────────
  useEffect(() => {
    if (!hydrated) return;

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    // Track flash-clear timers so we can cancel on unmount
    const flashTimers: ReturnType<typeof setTimeout>[] = [];

    const clearFlash = (alertId: string) => {
      setLeaderboard((prev) =>
        prev.map((e) => {
          if (e.alert_id === alertId) {
            const { _flash, ...rest } = e;
            return rest as LeaderboardEntry;
          }
          return e;
        })
      );
    };

    const scheduleFlashClear = (alertId: string, ms = 2000) => {
      const t = setTimeout(() => clearFlash(alertId), ms);
      flashTimers.push(t);
    };

    const connect = () => {
      ws = new WebSocket("ws://localhost:8000/ws/leaderboard");

      ws.onmessage = (event) => {
        try {
          const msg: LeaderboardEvent = JSON.parse(event.data);
          setLastLeaderboardEvent(msg);

          if (msg.event === "SNAPSHOT" && msg.board) {
            // Replace entire board — no flash on initial load
            setLeaderboard(msg.board.map((e) => {
              const { _flash, ...rest } = e;
              return rest as LeaderboardEntry;
            }));

          } else if (msg.event === "NEW_ENTRY" && msg.entry) {
            const entry: LeaderboardEntry = { ...msg.entry, _flash: "new" };
            setLeaderboard((prev) => {
              // Remove if trader already present (stale), insert, sort, cap 80
              const without = prev.filter((e) => e.trader_id !== entry.trader_id);
              const next = [...without, entry]
                .sort((a, b) => b.risk_score - a.risk_score)
                .slice(0, 81)
                .map((e, i) => ({ ...e, rank: i + 1 }));
              return next;
            });
            scheduleFlashClear(entry.alert_id);

          } else if (msg.event === "RANK_CHANGE" && msg.entry) {
            const entry: LeaderboardEntry = { ...msg.entry, _flash: "moved" };
            setLeaderboard((prev) => {
              const next = prev
                .map((e) => (e.trader_id === entry.trader_id ? entry : e))
                .sort((a, b) => b.risk_score - a.risk_score)
                .slice(0, 81)
                .map((e, i) => ({ ...e, rank: i + 1 }));
              return next;
            });
            scheduleFlashClear(entry.alert_id);

          } else if (msg.event === "SCORE_UPDATE" && msg.entry) {
            const entry: LeaderboardEntry = { ...msg.entry, _flash: "updated" };
            setLeaderboard((prev) =>
              prev
                .map((e) => (e.trader_id === entry.trader_id ? entry : e))
                .sort((a, b) => b.risk_score - a.risk_score)
                .slice(0, 81)
                .map((e, i) => ({ ...e, rank: i + 1 })),
            );
            scheduleFlashClear(entry.alert_id);

          } else if (msg.event === "REMOVED" && msg.entry) {
            const entry: LeaderboardEntry = { ...msg.entry, _flash: "removed" };
            // Brief fade-out then remove
            setLeaderboard((prev) =>
              prev.map((e) => (e.trader_id === entry.trader_id ? { ...e, _flash: "removed" } : e)),
            );
            const t = setTimeout(() => {
              setLeaderboard((prev) =>
                prev
                  .filter((e) => e.trader_id !== entry.trader_id)
                  .map((e, i) => ({ ...e, rank: i + 1 })),
              );
            }, 500);
            flashTimers.push(t);
          }
        } catch (err) {
          console.error("Leaderboard WS error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      flashTimers.forEach(clearTimeout);
      if (ws) ws.close();
    };
  }, [hydrated]);

  // Real-time live feed from FastAPI backend
  useEffect(() => {
    if (!hydrated || !live) return;
    
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket("ws://localhost:8000/ws/live-feed");
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "trade" && msg.data) {
            const raw = msg.data;
            
            const trade: Trade = {
              trade_id: raw.trade_id || `TRD-${Date.now()}`,
              trader_id: raw.trader_id || "Unknown",
              company: raw.company || raw.ticker || "Unknown",
              symbol: raw.ticker || "UNK",
              trade_type: raw.action === "SELL" ? "SELL" : "BUY",
              quantity: raw.quantity || 0,
              price: raw.price || 0,
              timestamp: raw.trade_timestamp ? new Date(raw.trade_timestamp).toISOString() : new Date().toISOString(),
            };
            
            setTrades((prev) => [trade, ...prev].slice(0, 40));
            setTradesMonitored((n) => n + 1);
            
            if (raw.is_flagged || (raw.risk_score && raw.risk_score >= 40)) {
              const alert: Alert = {
                alert_id: `ALT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                case_id: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
                trader_id: trade.trader_id,
                stock: trade.symbol,
                company: trade.company,
                risk_score: raw.risk_score || 0,
                severity: (raw.severity as Severity) || severityFor(raw.risk_score || 0),
                status: "Pending",
                fraud_type: raw.fraud_probability > 0.8 ? "Insider Trading" : "Market Manipulation",
                fraud_probability: raw.fraud_probability || 0,
                anomaly_score: raw.anomaly_score || 0,
                created_at: new Date().toISOString(),
                assigned_to: "Unassigned",
                reason: `ML model flagged trade with ${(raw.fraud_probability * 100).toFixed(1)}% probability. Risk score: ${raw.risk_score}.`,
                top_reasons: [],
              };
              setAlerts((prev) => [alert, ...prev].slice(0, 80));
              
              setTimeline((prev) => {
                const next = [
                  ...prev,
                  {
                    t: new Date().toISOString().slice(11, 16),
                    detections: prev.length > 0 ? prev[prev.length - 1]!.detections + 1 : 1,
                    critical: prev.length > 0 ? prev[prev.length - 1]!.critical + (alert.severity === "Critical" ? 1 : 0) : 0,
                  },
                ];
                return next.slice(-22);
              });
            }
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        if (live) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    };
    
    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [hydrated, live]);

  const value = useMemo<SentinelState>(
    () => ({
      hydrated,
      user,
      login,
      logout,
      live,
      setLive,
      trades,
      alerts,
      blockchain,
      timeline,
      tradesMonitored,
      autoAnchorThreshold,
      setAutoAnchorThreshold,
      leaderboard,
      lastLeaderboardEvent,
      anchorCase,
      updateAlert,
      cases,
      fetchCases,
      updateCaseStatus,
      anchorCaseToBlockchain,
    }),
    [
      hydrated,
      user,
      login,
      logout,
      live,
      trades,
      alerts,
      blockchain,
      timeline,
      tradesMonitored,
      autoAnchorThreshold,
      leaderboard,
      lastLeaderboardEvent,
      anchorCase,
      updateAlert,
      cases,
      fetchCases,
      updateCaseStatus,
      anchorCaseToBlockchain,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSentinel() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSentinel must be used inside SentinelProvider");
  return ctx;
}
