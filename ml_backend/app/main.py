"""
=============================================================================
 INSIDER TRADING & FRAUDULENT BEHAVIOUR DETECTOR
 FastAPI Backend  —  v1.0
 Endpoints:
   POST /api/predict          — single trade prediction
   POST /api/predict/batch    — batch predictions
   GET  /api/trade/{id}       — trade detail with SHAP
   GET  /api/stats            — model & dataset statistics
   WS   /ws/live-feed         — WebSocket live trade stream
=============================================================================
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

from app.core.config import settings
from app.core.model_loader import ModelLoader
from app.routers import trades, stats, websocket, data_sources, blockchain
from app.blockchain.config import blockchain_settings
from app.blockchain.client import blockchain_client

# ─────────────────────────────────────────────────
#  LIFESPAN  (startup / shutdown)
# ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models and initialize blockchain client if enabled at startup."""
    print("🚀 Loading ML models ...")
    ModelLoader.load()
    print("✅ Models loaded.")
    if blockchain_settings.BLOCKCHAIN_ENABLED:
        print("🔗 Initializing blockchain client ...")
        blockchain_client.initialize()
    print("⚡ Server ready.")
    yield
    print("🛑 Shutting down ...")


# ─────────────────────────────────────────────────
#  APP
# ─────────────────────────────────────────────────
app = FastAPI(
    title="Insider Trading Detector API",
    description="Real-time ML surveillance system for detecting insider trading and market manipulation.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────
#  ROUTERS
# ─────────────────────────────────────────────────
app.include_router(trades.router,        prefix="/api", tags=["Trades"])
app.include_router(stats.router,         prefix="/api", tags=["Stats"])
app.include_router(data_sources.router,  prefix="/api", tags=["Data Sources"])
app.include_router(blockchain.router,    prefix="/api", tags=["Blockchain"])
app.include_router(websocket.router,     tags=["WebSocket"])
app.include_router(leaderboard_ws.router, tags=["Leaderboard"])


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "Insider Trading Detector",
        "version": "1.0.0",
        "status" : "operational",
        "docs"   : "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    models_ok = ModelLoader.is_loaded()
    return {
        "status" : "healthy" if models_ok else "degraded",
        "models_loaded": models_ok,
    }
