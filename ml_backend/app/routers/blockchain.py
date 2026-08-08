"""
Blockchain API Router — Server-side automated blockchain actions & audit verifier.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Any

from app.blockchain.config import blockchain_settings
from app.blockchain.client import blockchain_client
from app.blockchain.service import blockchain_service

router = APIRouter()


class ManualRecordAlertInput(BaseModel):
    trade_id: str
    trader_id: str
    risk_score: float
    severity: str
    shap_proof_hash: Optional[str] = None
    shap_explanations: Optional[List[dict]] = None


class ResolveAlertInput(BaseModel):
    resolution_note: str = "Resolved by Compliance Officer"


@router.get("/blockchain/status", summary="Blockchain service & wallet status")
def get_blockchain_status():
    enabled = blockchain_settings.BLOCKCHAIN_ENABLED
    connected = blockchain_client.is_connected() if enabled else False
    wallet_address = blockchain_client.get_wallet_address() if connected else None
    balance = blockchain_client.get_gas_balance() if connected else 0.0
    alert_count = blockchain_service.get_alert_count() if connected else 0

    return {
        "enabled": enabled,
        "connected": connected,
        "rpc_url": blockchain_settings.BLOCKCHAIN_RPC_URL if enabled else None,
        "chain_id": blockchain_settings.BLOCKCHAIN_CHAIN_ID if enabled else None,
        "contract_address": blockchain_settings.FACTORFLOW_CONTRACT_ADDRESS if enabled else None,
        "server_wallet": wallet_address,
        "gas_balance_eth": balance,
        "total_alerts_on_chain": alert_count,
    }


@router.post("/blockchain/alerts", summary="Record trade alert on-chain manually")
def record_alert_on_chain(payload: ManualRecordAlertInput, background_tasks: BackgroundTasks):
    if not blockchain_settings.BLOCKCHAIN_ENABLED:
        raise HTTPException(status_code=400, detail="Blockchain integration is disabled")

    # Record alert via background task to avoid blocking HTTP response
    background_tasks.add_task(
        blockchain_service.record_alert,
        payload.trade_id,
        payload.trader_id,
        payload.risk_score,
        payload.severity,
        payload.shap_explanations,
        payload.shap_proof_hash,
    )

    return {
        "status": "queued",
        "message": f"Blockchain recording for trade {payload.trade_id} queued in background.",
        "trade_id": payload.trade_id,
    }


@router.post("/blockchain/alerts/{trade_id}/resolve", summary="Resolve trade alert on-chain")
def resolve_alert_on_chain(trade_id: str, payload: ResolveAlertInput):
    if not blockchain_settings.BLOCKCHAIN_ENABLED:
        raise HTTPException(status_code=400, detail="Blockchain integration is disabled")

    result = blockchain_service.resolve_alert(trade_id, payload.resolution_note)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("detail", result.get("reason", "Resolution failed")))

    return result


@router.get("/blockchain/alerts/{trade_id}", summary="Get on-chain alert details")
def get_on_chain_alert(trade_id: str):
    if not blockchain_settings.BLOCKCHAIN_ENABLED:
        raise HTTPException(status_code=400, detail="Blockchain integration is disabled")

    alert = blockchain_service.get_alert(trade_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {trade_id} not found on-chain")

    return alert


@router.get("/blockchain/trader/{trader_id}", summary="Get trader's on-chain alert IDs")
def get_trader_on_chain_alerts(trader_id: str):
    if not blockchain_settings.BLOCKCHAIN_ENABLED:
        raise HTTPException(status_code=400, detail="Blockchain integration is disabled")

    trade_ids = blockchain_service.get_trader_alerts(trader_id)
    return {"trader_id": trader_id, "alert_trade_ids": trade_ids, "count": len(trade_ids)}
