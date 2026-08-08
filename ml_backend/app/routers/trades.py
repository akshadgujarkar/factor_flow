from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.schemas.trade import TradeInput, PredictionResponse, BatchTradeInput, BatchPredictionResponse
from app.services.predictor import predict_single, predict_batch
from app.core.model_loader import ModelLoader
from app.blockchain.config import blockchain_settings
from app.blockchain.service import blockchain_service

router = APIRouter()


@router.post("/predict", response_model=PredictionResponse, summary="Predict a single trade")
def predict_trade(trade: TradeInput, background_tasks: BackgroundTasks):
    """
    Run the full hybrid ML pipeline on a single trade:
    - XGBoost fraud probability
    - Isolation Forest anomaly score
    - Hybrid risk score (weighted blend)
    - SHAP feature attributions (top 10)
    - Asynchronous automated blockchain recording if flagged and BLOCKCHAIN_ENABLED=true
    """
    if not ModelLoader.is_loaded():
        raise HTTPException(status_code=503, detail="Models not loaded yet")

    result = predict_single(trade.model_dump())
    result["trade_id"] = trade.trade_id

    # If blockchain is enabled and risk_score > threshold, record on-chain asynchronously
    risk_score = result.get("risk_score", 0.0)
    threshold = blockchain_settings.BLOCKCHAIN_RISK_THRESHOLD
    if blockchain_settings.BLOCKCHAIN_ENABLED and risk_score > threshold:
        background_tasks.add_task(
            blockchain_service.record_alert,
            trade.trade_id or "TRD_UNKNOWN",
            trade.trader_id or "TRD_UNKNOWN",
            risk_score,
            result.get("severity", "Medium"),
            result.get("shap_explanations"),
        )

    return result


@router.post("/predict/batch", response_model=BatchPredictionResponse, summary="Batch trade predictions")
def predict_trades_batch(batch: BatchTradeInput, background_tasks: BackgroundTasks):
    """
    Efficient batch prediction for up to 1000 trades at once.
    Returns risk scores without per-trade SHAP (use /predict for SHAP).
    Asynchronously records high-risk batch alerts on-chain if BLOCKCHAIN_ENABLED=true and risk_score > threshold.
    """
    if not ModelLoader.is_loaded():
        raise HTTPException(status_code=503, detail="Models not loaded yet")

    if len(batch.trades) > 1000:
        raise HTTPException(status_code=400, detail="Maximum 1000 trades per batch")

    trade_dicts = [t.model_dump() for t in batch.trades]
    results     = predict_batch(trade_dicts)
    flagged     = sum(1 for r in results if r.get("is_flagged"))

    if blockchain_settings.BLOCKCHAIN_ENABLED:
        threshold = blockchain_settings.BLOCKCHAIN_RISK_THRESHOLD
        for res in results:
            r_score = res.get("risk_score", 0.0)
            if r_score > threshold:
                background_tasks.add_task(
                    blockchain_service.record_alert,
                    res.get("trade_id") or "TRD_UNKNOWN",
                    res.get("trader_id") or "TRD_UNKNOWN",
                    r_score,
                    res.get("severity", "Medium"),
                )

    return {"count": len(results), "flagged": flagged, "results": results}
