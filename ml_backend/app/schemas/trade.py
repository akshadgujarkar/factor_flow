from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class TradeInput(BaseModel):
    trade_id: Optional[str] = None
    trader_id: Optional[str] = None
    company_id: Optional[str] = None
    ticker: Optional[str] = None
    trade_timestamp: Optional[str] = None
    action: str = "BUY"
    instrument: str = "Equity"
    order_type: str = "Market"
    quantity: float = 1000
    price: float = 500.0
    trade_value: float = 500000.0
    volume_ratio: float = 1.0
    volume_zscore_30d: float = 0.0
    trade_frequency_1h: int = 2
    trade_frequency_24h: int = 10
    buy_sell_ratio: float = 1.0
    hours_to_next_event: float = 500.0
    hours_since_last_event: float = 500.0
    is_pre_event_window: bool = False
    peer_group_deviation: float = 0.0
    unusual_instrument_flag: bool = False
    after_hours_flag: bool = False
    consecutive_profitable_trades: int = 0
    price_impact_proxy: float = 0.05
    network_risk: float = 0.1
    pnl_pct: float = 0.0

    class Config:
        json_schema_extra = {
            "example": {
                "trade_id": "TRD0001234",
                "trader_id": "TRD0007",
                "ticker": "AAPL",
                "action": "BUY",
                "instrument": "Options",
                "quantity": 50000,
                "price": 1245.50,
                "trade_value": 62275000,
                "volume_ratio": 8.5,
                "volume_zscore_30d": 4.2,
                "hours_to_next_event": 12.5,
                "is_pre_event_window": True,
                "peer_group_deviation": 3.7,
                "unusual_instrument_flag": True,
                "after_hours_flag": False,
                "network_risk": 0.72,
            }
        }


class SHAPExplanation(BaseModel):
    feature: str
    shap_value: float
    feature_value: float


class PredictionResponse(BaseModel):
    trade_id: Optional[str] = None
    fraud_probability: float
    anomaly_score: float
    rule_engine_score: float
    network_risk: float
    risk_score: float
    severity: str
    is_flagged: bool
    shap_explanations: List[SHAPExplanation]


class BatchTradeInput(BaseModel):
    trades: List[TradeInput]


class BatchPredictionResponse(BaseModel):
    count: int
    flagged: int
    results: List[dict]
