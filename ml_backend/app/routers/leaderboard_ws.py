"""
WS /ws/leaderboard

On connect:
  1. Sends a SNAPSHOT event with the full current leaderboard (up to 80 entries)
  2. Subscribes to LeaderboardManager events
  3. Streams NEW_ENTRY / RANK_CHANGE / SCORE_UPDATE / REMOVED events as they arrive

Clients should reconnect on disconnect (handled in the frontend hook).
"""

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.leaderboard import LeaderboardManager

router = APIRouter()


@router.websocket("/ws/leaderboard")
async def leaderboard_feed(websocket: WebSocket):
    """
    Real-time leaderboard WebSocket.
    Immediately sends a SNAPSHOT, then streams differential events.
    """
    await websocket.accept()
    queue = LeaderboardManager.subscribe()

    try:
        # ── 1. Send full snapshot on connect ────────────────────────────
        snapshot = {
            "event": "SNAPSHOT",
            "board": LeaderboardManager.snapshot(),
        }
        await websocket.send_json(snapshot)

        # ── 2. Stream events ─────────────────────────────────────────────
        while True:
            try:
                # Wait up to 30 s for the next event; send a heartbeat if idle
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_json(event)
            except asyncio.TimeoutError:
                # Heartbeat keeps the connection alive through proxies
                await websocket.send_json({"event": "HEARTBEAT"})

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        LeaderboardManager.unsubscribe(queue)
