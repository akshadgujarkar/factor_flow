import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade } from "@/types/sentinel";
import { severityFor } from "@/data/mock";
import { SeverityBadge } from "./badges";

/** Deterministic pseudo risk derived from the trade payload (backend supplies the real one). */
export function tradeRisk(t: Trade) {
  const seed =
    (t.quantity % 977) / 977 * 0.6 +
    ((t.trade_id.charCodeAt(t.trade_id.length - 1) % 37) / 37) * 0.4;
  return Math.round(18 + seed * 78);
}

export function LiveTradeTable({ trades, limit = 10 }: { trades: Trade[]; limit?: number }) {
  const [flash, setFlash] = useState<string | null>(null);
  const last = useRef<string | undefined>(undefined);

  useEffect(() => {
    const top = trades[0]?.trade_id;
    if (top && top !== last.current) {
      last.current = top;
      setFlash(top);
      const id = setTimeout(() => setFlash(null), 1400);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [trades]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="px-3 py-2 font-normal">Trade ID</th>
            <th className="px-3 py-2 font-normal">Trader</th>
            <th className="px-3 py-2 font-normal">Symbol</th>
            <th className="px-3 py-2 font-normal">Side</th>
            <th className="px-3 py-2 text-right font-normal">Qty</th>
            <th className="px-3 py-2 text-right font-normal">Price</th>
            <th className="px-3 py-2 font-normal">Risk</th>
            <th className="px-3 py-2 text-right font-normal">Time</th>
          </tr>
        </thead>
        <tbody>
          {trades.slice(0, limit).map((t) => {
            const risk = tradeRisk(t);
            return (
              <tr
                key={t.trade_id}
                className={cn(
                  "border-b border-border/50 transition-colors hover:bg-elevated/60",
                  flash === t.trade_id && "flash-in",
                )}
              >
                <td className="px-3 py-2 font-mono text-xs text-cyan">{t.trade_id}</td>
                <td className="px-3 py-2 font-mono text-xs text-foreground">{t.trader_id}</td>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs text-foreground">{t.symbol}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground">{t.company}</span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-mono text-[11px]",
                      t.trade_type === "BUY" ? "text-low" : "text-critical",
                    )}
                  >
                    {t.trade_type === "BUY" ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {t.trade_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-foreground">
                  {t.quantity.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-foreground">
                  {t.price.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <SeverityBadge severity={severityFor(risk)} />
                </td>
                <td className="px-3 py-2 text-right font-mono text-[11px] text-muted-foreground">
                  {new Date(t.timestamp).toISOString().slice(11, 19)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
