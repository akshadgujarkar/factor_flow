"""
LeaderboardManager — in-memory Top-80 risk leaderboard of unique traders.

Maintains a dictionary of all unique traders seen in the session and their
highest risk_score. The top 80 traders are continuously computed and any 
changes emit events.

Events
------
  SNAPSHOT     — full board state (sent once on WS connect)
  NEW_ENTRY    — a trader entered the top 80
  RANK_CHANGE  — an existing entry's rank moved
  SCORE_UPDATE — an existing entry got a higher score but rank didn't change
  REMOVED      — an entry was bumped out of the top 80
"""

import asyncio
from typing import Any

LEADERBOARD_SIZE = 80


class _Board:
    """Mutable singleton board state."""
    trader_best: dict[str, dict] = {}  # trader_id -> best entry details
    top_80: list[dict] = []            # sorted descending by risk_score
    _lock: asyncio.Lock | None = None
    _subscribers: list[asyncio.Queue] = []

    @classmethod
    def lock(cls) -> asyncio.Lock:
        if cls._lock is None:
            cls._lock = asyncio.Lock()
        return cls._lock


class LeaderboardManager:
    """Static façade over _Board. All mutating calls are async (use the lock)."""

    @staticmethod
    def snapshot() -> list[dict]:
        """Return a shallow copy of the current Top 80 with ranks attached."""
        return [
            {**e, "rank": i + 1}
            for i, e in enumerate(_Board.top_80)
        ]

    @staticmethod
    async def ingest(scored_trade: dict[str, Any]) -> dict | None:
        """
        Process one scored trade. Returns the primary event dict for the 
        incoming trade, or None if it doesn't trigger an update to the Top 80.
        """
        async with _Board.lock():
            trader_id  = scored_trade.get("trader_id", "UNK")
            risk_score = float(scored_trade.get("risk_score", 0))

            # Build a clean leaderboard entry from the scored trade
            entry = _make_entry(scored_trade)

            # ── 1. Maintain highest risk score per trader ──────────
            if trader_id in _Board.trader_best:
                existing = _Board.trader_best[trader_id]
                # If old score is higher, keep it, but update trade details
                if existing["risk_score"] > risk_score:
                    entry["risk_score"] = existing["risk_score"]
                    entry["severity"] = existing["severity"]
                    entry["fraud_probability"] = max(existing["fraud_probability"], entry["fraud_probability"])
                    entry["anomaly_score"] = max(existing["anomaly_score"], entry["anomaly_score"])
            
            _Board.trader_best[trader_id] = entry

            # ── 2. Recompute Top 80 ────────────────────────────────
            old_top_80 = _Board.top_80
            old_ranks = {e["trader_id"]: i + 1 for i, e in enumerate(old_top_80)}

            all_entries = list(_Board.trader_best.values())
            all_entries.sort(key=lambda e: e["risk_score"], reverse=True)
            
            new_top_80 = all_entries[:LEADERBOARD_SIZE]
            _Board.top_80 = new_top_80
            new_ranks = {e["trader_id"]: i + 1 for i, e in enumerate(new_top_80)}

            events = []

            # ── 3. Check what happened to the incoming trader ──────
            if trader_id in new_ranks:
                new_rank = new_ranks[trader_id]
                updated_entry = {**entry, "rank": new_rank}

                if trader_id not in old_ranks:
                    events.append({
                        "event": "NEW_ENTRY",
                        "entry": updated_entry,
                        "rank": new_rank
                    })
                else:
                    prev_rank = old_ranks[trader_id]
                    # Only emit an event if rank changed or score actually increased
                    if new_rank != prev_rank:
                        events.append({
                            "event": "RANK_CHANGE",
                            "entry": updated_entry,
                            "rank": new_rank,
                            "prev_rank": prev_rank
                        })
                    else:
                        # Even if score didn't change mathematically, we emit SCORE_UPDATE
                        # so the frontend flashes and shows the latest trade ID
                        events.append({
                            "event": "SCORE_UPDATE",
                            "entry": updated_entry,
                            "rank": new_rank
                        })

            # ── 4. Check for removed traders ───────────────────────
            for old_trader_id, old_rank in old_ranks.items():
                if old_trader_id not in new_ranks:
                    removed_entry = next((e for e in old_top_80 if e["trader_id"] == old_trader_id), None)
                    if removed_entry:
                        events.append({
                            "event": "REMOVED",
                            "entry": {**removed_entry, "rank": LEADERBOARD_SIZE + 1},
                            "rank": LEADERBOARD_SIZE + 1
                        })

            # Publish all generated events
            for ev in events:
                await _publish(ev)

            # Return the primary event (the first one) so caller knows something happened
            return events[0] if events else None

    @staticmethod
    def subscribe() -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=256)
        _Board._subscribers.append(q)
        return q

    @staticmethod
    def unsubscribe(q: asyncio.Queue) -> None:
        try:
            _Board._subscribers.remove(q)
        except ValueError:
            pass


async def _publish(event: dict) -> None:
    """Put an event on every subscriber's queue (drop if full to avoid blocking)."""
    for q in list(_Board._subscribers):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass  # slow consumer — drop rather than block the pipeline


# ── Helpers ────────────────────────────────────────────────────────────────

def _fraud_type(fraud_prob: float, anomaly_type: str | None) -> str:
    """Derive a fraud type label from ML scores."""
    if anomaly_type and anomaly_type not in ("", "nan", "None"):
        mapping = {
            "spoofing"           : "Spoofing",
            "insider_trading"    : "Insider Trading",
            "market_manipulation": "Market Manipulation",
            "pump_and_dump"      : "Pump and Dump",
            "wash_trading"       : "Wash Trading",
            "front_running"      : "Front Running",
        }
        return mapping.get(str(anomaly_type).lower(), str(anomaly_type).title())
    if fraud_prob >= 0.80:
        return "Insider Trading"
    if fraud_prob >= 0.60:
        return "Market Manipulation"
    return "Spoofing"


def _make_entry(trade: dict) -> dict:
    """Construct a leaderboard entry dict from a scored trade dict."""
    fraud_prob   = float(trade.get("fraud_probability", 0))
    risk_score   = float(trade.get("risk_score", 0))
    anomaly_score = float(trade.get("anomaly_score", 0))
    severity     = str(trade.get("severity", "Low"))
    ticker       = str(trade.get("ticker", trade.get("symbol", "UNK")))

    return {
        # Identity
        "alert_id"        : f"LB-{trade.get('trade_id', 'UNK')}",
        "case_id"         : f"INV-LB-{trade.get('trade_id', 'UNK')}",
        "trade_id"        : str(trade.get("trade_id", "")),
        "trader_id"       : str(trade.get("trader_id", "UNK")),
        "stock"           : ticker,
        "company"         : str(trade.get("company", ticker)),
        # ML scores
        "risk_score"      : round(risk_score, 2),
        "fraud_probability": round(fraud_prob, 4),
        "anomaly_score"   : round(anomaly_score, 4),
        "severity"        : severity,
        "fraud_type"      : _fraud_type(fraud_prob, trade.get("anomaly_type")),
        # Alert metadata
        "status"          : "Pending",
        "assigned_to"     : "Unassigned",
        "created_at"      : str(trade.get("trade_timestamp", "")),
        "reason"          : (
            f"ML pipeline flagged {ticker} — "
            f"fraud prob {fraud_prob:.1%}, risk score {risk_score:.0f}."
        ),
        "top_reasons"     : [],
    }
