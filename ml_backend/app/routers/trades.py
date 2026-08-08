from fastapi import APIRouter, HTTPException
from app.schemas.trade import TradeInput, PredictionResponse, BatchTradeInput, BatchPredictionResponse
from app.services.predictor import predict_single, predict_batch
from app.core.model_loader import ModelLoader

router = APIRouter()


@router.post("/predict", response_model=PredictionResponse, summary="Predict a single trade")
def predict_trade(trade: TradeInput):
    """
    Run the full hybrid ML pipeline on a single trade:
    - XGBoost fraud probability
    - Isolation Forest anomaly score
    - Hybrid risk score (weighted blend)
    - SHAP feature attributions (top 10)
    """
    if not ModelLoader.is_loaded():
        raise HTTPException(status_code=503, detail="Models not loaded yet")

    result = predict_single(trade.model_dump())
    result["trade_id"] = trade.trade_id
    return result


@router.post("/predict/batch", response_model=BatchPredictionResponse, summary="Batch trade predictions")
def predict_trades_batch(batch: BatchTradeInput):
    """
    Efficient batch prediction for up to 1000 trades at once.
    Returns risk scores without per-trade SHAP (use /predict for SHAP).
    """
    if not ModelLoader.is_loaded():
        raise HTTPException(status_code=503, detail="Models not loaded yet")

    if len(batch.trades) > 1000:
        raise HTTPException(status_code=400, detail="Maximum 1000 trades per batch")

    trade_dicts = [t.model_dump() for t in batch.trades]
    results     = predict_batch(trade_dicts)
    flagged     = sum(1 for r in results if r.get("is_flagged"))

    return {"count": len(results), "flagged": flagged, "results": results}
