"""
WebSocket live trade feed — streams demo_trades.csv row by row
with real-time ML predictions. Clients receive JSON messages
with full trade context + risk scores.
"""

import asyncio
import json
import random
from pathlib import Path
from typing import Set

import pandas as pd
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.services.predictor import predict_batch

router = APIRouter()

# ─────────────────────────────────────────────────────
#  Load demo trades (done once at import time)
# ─────────────────────────────────────────────────────
_DEMO_PATH = settings.DATA_DIR / "demo_trades.csv"
_demo_df   = None

def _get_demo_trades() -> pd.DataFrame:
    global _demo_df
    if _demo_df is None:
        _demo_df = pd.read_csv(_DEMO_PATH)
        _demo_df["trade_timestamp"] = _demo_df["trade_timestamp"].astype(str)
        # Replace sentinel 9999 with 500
        for col in ["hours_to_next_event", "hours_since_last_event"]:
            if col in _demo_df.columns:
                _demo_df[col] = _demo_df[col].clip(upper=500)
    return _demo_df


# Active WebSocket connections
_active_connections: Set[WebSocket] = set()


@router.websocket("/ws/live-feed")
async def live_feed(websocket: WebSocket):
    """
    WebSocket endpoint — streams live trade alerts.
    Each message is a JSON object with:
      - trade fields
      - fraud_probability, anomaly_score, risk_score, severity
      - is_flagged flag
    """
    await websocket.accept()
    _active_connections.add(websocket)

    df = _get_demo_trades()
    trade_records = df.to_dict(orient="records")
    random.shuffle(trade_records)   # randomise order each session

    try:
        # Send handshake
        await websocket.send_json({
            "type"   : "connected",
            "message": "Live feed started",
            "total_trades": len(trade_records),
        })

        batch_size = 5
        for i in range(0, len(trade_records), batch_size):
            batch = trade_records[i : i + batch_size]
            try:
                predictions = predict_batch(batch)
            except Exception as e:
                predictions = batch   # fallback: send raw trade without ML scores

            for pred in predictions:
                # Convert any non-serializable types
                msg = {k: (bool(v) if isinstance(v, (bool,)) else
                            int(v)  if isinstance(v, (int, float)) and str(v) in ("True","False") else
                            v)
                       for k, v in pred.items()}
                await websocket.send_json({"type": "trade", "data": msg})
                await asyncio.sleep(settings.WS_INTERVAL)

        # End of stream
        await websocket.send_json({"type": "end", "message": "Stream complete"})

    except WebSocketDisconnect:
        pass
    finally:
        _active_connections.discard(websocket)
