"""
Prediction service: feature engineering → XGBoost → Isolation Forest → Hybrid Risk Score
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List

from app.core.model_loader import ModelLoader
from app.core.config import settings


FEATURE_COLS = None   # populated lazily from ModelLoader


def _build_feature_row(trade: Dict[str, Any]) -> pd.DataFrame:
    """Convert a raw trade dict to the ordered feature DataFrame."""
    global FEATURE_COLS
    if FEATURE_COLS is None:
        FEATURE_COLS = ModelLoader.get_features()

    row = dict(trade)   # shallow copy

    # Engineer derived features (mirrors train_model.py)
    from datetime import datetime
    ts = trade.get("trade_timestamp")
    if isinstance(ts, str):
        ts = pd.Timestamp(ts)
    elif ts is None:
        ts = pd.Timestamp.now()

    row["hour_of_day"]    = ts.hour
    row["day_of_week"]    = ts.dayofweek
    row["is_weekend"]     = int(ts.dayofweek >= 5)
    row["month"]          = ts.month

    row["hours_to_next_event"]    = min(row.get("hours_to_next_event", 500), 500)
    row["hours_since_last_event"] = min(row.get("hours_since_last_event", 500), 500)

    row["is_pre_event_window"]  = int(bool(row.get("is_pre_event_window", False)))
    row["unusual_instrument_flag"] = int(bool(row.get("unusual_instrument_flag", False)))
    row["after_hours_flag"]     = int(bool(row.get("after_hours_flag", False)))

    row["action_buy"]          = int(row.get("action", "BUY") == "BUY")
    row["instrument_options"]  = int(row.get("instrument", "") == "Options")
    row["instrument_futures"]  = int(row.get("instrument", "") == "Futures")
    row["order_market"]        = int(row.get("order_type", "") == "Market")

    tv  = max(0, float(row.get("trade_value", 0)))
    qty = max(0, float(row.get("quantity", 0)))
    px  = max(0, float(row.get("price", 0)))
    row["log_trade_value"] = np.log1p(tv)
    row["log_quantity"]    = np.log1p(qty)
    row["log_price"]       = np.log1p(px)

    # Build DataFrame with correct column order
    df = pd.DataFrame([{col: row.get(col, 0) for col in FEATURE_COLS}])
    df = df.fillna(0)
    return df


def _severity(score: float) -> str:
    if score >= settings.SEVERITY_CRITICAL:
        return "Critical"
    elif score >= settings.SEVERITY_HIGH:
        return "High"
    elif score >= settings.SEVERITY_MEDIUM:
        return "Medium"
    return "Low"


def predict_single(trade: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run the full hybrid pipeline on a single trade.
    Returns enriched dict with fraud_probability, anomaly_score,
    risk_score, severity, and SHAP explanations.
    """
    xgb_model  = ModelLoader.get_xgb()
    iso_forest = ModelLoader.get_iso()
    scaler     = ModelLoader.get_scaler()
    explainer  = ModelLoader.get_shap()

    X = _build_feature_row(trade)

    # ── XGBoost ──────────────────────────────────
    fraud_prob = float(xgb_model.predict_proba(X)[0, 1])

    # ── Isolation Forest ─────────────────────────
    X_scaled   = scaler.transform(X)
    iso_raw    = float(iso_forest.decision_function(X_scaled)[0])
    # Normalise: we use a fixed range from training (conservative)
    iso_anom   = float(np.clip(1.0 - (iso_raw + 0.5) / 1.0, 0.0, 1.0))

    # ── Network risk ─────────────────────────────
    net_risk   = float(X["network_risk"].values[0])

    # ── Hybrid risk score ─────────────────────────
    risk_score = float(np.clip(
        100 * (
            settings.WEIGHT_FRAUD   * fraud_prob +
            settings.WEIGHT_ANOMALY * iso_anom +
            settings.WEIGHT_RULE    * fraud_prob +   # rule proxy = xgb prob
            settings.WEIGHT_NETWORK * net_risk
        ),
        0, 100
    ))

    # ── SHAP explanations ─────────────────────────
    shap_vals  = explainer(X)
    shap_arr   = shap_vals.values[0]
    feat_names = ModelLoader.get_features()

    shap_explanations = sorted(
        [{"feature": f, "shap_value": round(float(v), 5),
          "feature_value": round(float(X[f].values[0]), 4)}
         for f, v in zip(feat_names, shap_arr)],
        key=lambda x: abs(x["shap_value"]),
        reverse=True
    )[:10]   # top 10 only

    return {
        "fraud_probability"   : round(fraud_prob, 4),
        "anomaly_score"        : round(iso_anom, 4),
        "rule_engine_score"    : round(fraud_prob, 4),   # proxy
        "network_risk"         : round(net_risk, 4),
        "risk_score"           : round(risk_score, 2),
        "severity"             : _severity(risk_score),
        "is_flagged"           : fraud_prob >= settings.XGB_THRESHOLD,
        "shap_explanations"    : shap_explanations,
    }


def predict_batch(trades: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Batch prediction — more efficient for the live feed."""
    global FEATURE_COLS
    if FEATURE_COLS is None:
        FEATURE_COLS = ModelLoader.get_features()

    xgb_model  = ModelLoader.get_xgb()
    iso_forest = ModelLoader.get_iso()
    scaler     = ModelLoader.get_scaler()

    rows = [_build_feature_row(t) for t in trades]
    X    = pd.concat(rows, ignore_index=True)

    fraud_probs = xgb_model.predict_proba(X)[:, 1]
    X_scaled    = scaler.transform(X)
    iso_raws    = iso_forest.decision_function(X_scaled)
    iso_anoms   = np.clip(1.0 - (iso_raws + 0.5) / 1.0, 0.0, 1.0)
    net_risks   = X["network_risk"].values

    risk_scores = np.clip(
        100 * (
            settings.WEIGHT_FRAUD   * fraud_probs +
            settings.WEIGHT_ANOMALY * iso_anoms   +
            settings.WEIGHT_RULE    * fraud_probs +
            settings.WEIGHT_NETWORK * net_risks
        ),
        0, 100
    )

    results = []
    for i, trade in enumerate(trades):
        results.append({
            **trade,
            "fraud_probability"  : round(float(fraud_probs[i]), 4),
            "anomaly_score"       : round(float(iso_anoms[i]), 4),
            "risk_score"          : round(float(risk_scores[i]), 2),
            "severity"            : _severity(float(risk_scores[i])),
            "is_flagged"          : bool(fraud_probs[i] >= settings.XGB_THRESHOLD),
        })
    return results
