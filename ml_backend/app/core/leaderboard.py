"""
LeaderboardManager — in-memory Top-80 risk leaderboard.

Maintains a sorted list (descending risk_score) of at most LEADERBOARD_SIZE
entries. Each call to `ingest()` scores a trade and returns a typed event
dict that the WebSocket router can broadcast to all connected clients.

Events
------
  SNAPSHOT     — full board state (sent once on WS connect)
  NEW_ENTRY    — a trade entered the leaderboard (pushed lowest out if full)
  RANK_CHANGE  — an existing entry's rank moved (re-sort after score update)
  SCORE_UPDATE — an existing entry got a new/higher score
  REMOVED      — an entry was bumped off the bottom of the board
"""

import asyncio
from typing import Any

LEADERBOARD_SIZE = 80


class _Board:
    """Mutable singleton board state."""
    entries: list[dict]  = []   # sorted descending by risk_score
    _lock: asyncio.Lock | None  = None
    _subscribers: list[asyncio.Queue] = []

    @classmethod
    def lock(cls) -> asyncio.Lock:
        if cls._lock is None:
            cls._lock = asyncio.Lock()
        return cls._lock


def _rank_of(board: list[dict], trader_id: str) -> int | None:
    """Return 1-based rank of trader in board, or None if not present."""
    for i, e in enumerate(board):
        if e["trader_id"] == trader_id:
            return i + 1
    return None


def _find_entry(board: list[dict], trader_id: str) -> tuple[int, dict] | tuple[None, None]:
    for i, e in enumerate(board):
        if e["trader_id"] == trader_id:
            return i, e
    return None, None


def _sort_board(board: list[dict]) -> list[dict]:
    return sorted(board, key=lambda e: e["risk_score"], reverse=True)


class LeaderboardManager:
    """Static façade over _Board. All mutating calls are async (use the lock)."""

    @staticmethod
    def snapshot() -> list[dict]:
        """Return a shallow copy of the current board with ranks attached."""
        return [
            {**e, "rank": i + 1}
            for i, e in enumerate(_Board.entries)
        ]

    @staticmethod
    async def ingest(scored_trade: dict[str, Any]) -> dict | None:
        """
        Process one scored trade. Returns an event dict or None if the trade
        doesn't qualify for the leaderboard.
        """
        async with _Board.lock():
            trader_id  = scored_trade.get("trader_id", "UNK")
            risk_score = float(scored_trade.get("risk_score", 0))

            # Build a clean leaderboard entry from the scored trade
            entry = _make_entry(scored_trade)

            board = _Board.entries
            idx, existing = _find_entry(board, trader_id)

            # ── Case 1: Trader already on the board ───────────────────────
            if existing is not None:
                prev_rank  = idx + 1
                old_score  = existing["risk_score"]
                board[idx] = entry
                board[:]   = _sort_board(board)
                new_rank   = _rank_of(board, trader_id)

                if new_rank != prev_rank:
                    event = {
                        "event"    : "RANK_CHANGE",
                        "entry"    : {**entry, "rank": new_rank},
                        "rank"     : new_rank,
                        "prev_rank": prev_rank,
                    }
                else:
                    event = {
                        "event": "SCORE_UPDATE",
                        "entry": {**entry, "rank": new_rank},
                        "rank" : new_rank,
                    }
                await _publish(event)
                return event

            # ── Case 2: Board not full yet ────────────────────────────────
            if len(board) < LEADERBOARD_SIZE:
                board.append(entry)
                board[:] = _sort_board(board)
                new_rank  = _rank_of(board, trader_id)
                event = {
                    "event": "NEW_ENTRY",
                    "entry": {**entry, "rank": new_rank},
                    "rank" : new_rank,
                }
                await _publish(event)
                return event

            # ── Case 3: Board full — check if trade beats the lowest entry ─
            lowest = board[-1]
            if risk_score > lowest["risk_score"]:
                removed_entry  = {**lowest, "rank": LEADERBOARD_SIZE}
                board[-1]      = entry
                board[:]       = _sort_board(board)
                new_rank       = _rank_of(board, trader_id)

                removed_event = {
                    "event": "REMOVED",
                    "entry": removed_entry,
                    "rank" : LEADERBOARD_SIZE,
                }
                new_event = {
                    "event": "NEW_ENTRY",
                    "entry": {**entry, "rank": new_rank},
                    "rank" : new_rank,
                }
                await _publish(removed_event)
                await _publish(new_event)
                return new_event

            # Trade doesn't make the cut
            return None

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
        # capitalise e.g. "spoofing" → "Spoofing"
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
