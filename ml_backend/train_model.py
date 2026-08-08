"""
=============================================================================
 INSIDER TRADING & FRAUDULENT BEHAVIOUR DETECTOR
 ML Training Pipeline  —  v1.0
 Trains: XGBoost Classifier + Isolation Forest + SHAP Explainer
 Saves artifacts to: models/
=============================================================================
"""

import os
import sys
import json
import pickle
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, average_precision_score,
    f1_score, precision_score, recall_score
)
from sklearn.ensemble import IsolationForest
import xgboost as xgb
import shap

warnings.filterwarnings("ignore")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ─────────────────────────────────────────────────
#  PATHS
# ─────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
DATA_DIR   = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

print("=" * 65)
print("  INSIDER TRADING DETECTOR  —  ML Training Pipeline v1.0")
print("=" * 65)

# ─────────────────────────────────────────────────
#  1.  LOAD DATA
# ─────────────────────────────────────────────────
print("\n[1/5] Loading trades.csv ...")
df = pd.read_csv(DATA_DIR / "trades.csv", parse_dates=["trade_timestamp"])
print(f"   OK  {len(df):,} trades loaded")
print(f"       Anomalies: {df['is_anomalous'].sum():,}  "
      f"({df['is_anomalous'].mean()*100:.1f}%)")

# ─────────────────────────────────────────────────
#  2.  FEATURE ENGINEERING
# ─────────────────────────────────────────────────
print("\n[2/5] Feature engineering ...")

# Time-based features
df["hour_of_day"]    = df["trade_timestamp"].dt.hour
df["day_of_week"]    = df["trade_timestamp"].dt.dayofweek
df["is_weekend"]     = (df["day_of_week"] >= 5).astype(int)
df["month"]          = df["trade_timestamp"].dt.month

# Cap hours_to_next_event and hours_since_last_event at 500 (sentinel 9999 -> 500)
df["hours_to_next_event"]    = df["hours_to_next_event"].clip(upper=500)
df["hours_since_last_event"] = df["hours_since_last_event"].clip(upper=500)

# Binary flags to int
bool_cols = [
    "is_pre_event_window", "unusual_instrument_flag",
    "after_hours_flag", "is_anomalous"
]
for c in bool_cols:
    df[c] = df[c].astype(int)

# Action encoding
df["action_buy"] = (df["action"] == "BUY").astype(int)

# Instrument encoding
df["instrument_options"]  = (df["instrument"] == "Options").astype(int)
df["instrument_futures"]  = (df["instrument"] == "Futures").astype(int)

# Order type encoding
df["order_market"] = (df["order_type"] == "Market").astype(int)

# Log-transform skewed features
df["log_trade_value"]  = np.log1p(df["trade_value"])
df["log_quantity"]     = np.log1p(df["quantity"])
df["log_price"]        = np.log1p(df["price"])

FEATURE_COLS = [
    # Volume / anomaly core
    "volume_ratio",
    "volume_zscore_30d",
    # Event proximity
    "hours_to_next_event",
    "hours_since_last_event",
    "is_pre_event_window",
    # Behavioral
    "peer_group_deviation",
    "buy_sell_ratio",
    "unusual_instrument_flag",
    "after_hours_flag",
    "consecutive_profitable_trades",
    "price_impact_proxy",
    "network_risk",
    # Trade frequency
    "trade_frequency_1h",
    "trade_frequency_24h",
    # P&L
    "pnl_pct",
    # Engineered
    "hour_of_day",
    "day_of_week",
    "is_weekend",
    "month",
    "action_buy",
    "instrument_options",
    "instrument_futures",
    "order_market",
    "log_trade_value",
    "log_quantity",
    "log_price",
]

TARGET = "is_anomalous"

X = df[FEATURE_COLS].copy()
y = df[TARGET].copy()

# Handle any remaining NaN
X = X.fillna(X.median())

print(f"   OK  {len(FEATURE_COLS)} features prepared")
print(f"       Features: {', '.join(FEATURE_COLS[:6])} ...")

# ─────────────────────────────────────────────────
#  3.  TRAIN / TEST SPLIT
# ─────────────────────────────────────────────────
print("\n[3/5] Splitting data & training models ...")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"   Train: {len(X_train):,}  |  Test: {len(X_test):,}")
print(f"   Train anomaly rate: {y_train.mean()*100:.1f}%")
print(f"   Test  anomaly rate: {y_test.mean()*100:.1f}%")

# Class imbalance weight for XGBoost
n_neg  = (y_train == 0).sum()
n_pos  = (y_train == 1).sum()
spw    = round(n_neg / n_pos, 2)
print(f"   scale_pos_weight   : {spw}  (neg/pos = {n_neg}/{n_pos})")

# ─────────────────────────────────────────────────
#  3a.  XGBOOST CLASSIFIER
# ─────────────────────────────────────────────────
print("\n   [3a] Training XGBoost ...")

xgb_params = {
    "n_estimators"      : 400,
    "max_depth"         : 6,
    "learning_rate"     : 0.05,
    "subsample"         : 0.8,
    "colsample_bytree"  : 0.8,
    "min_child_weight"  : 5,
    "gamma"             : 1.0,
    "reg_alpha"         : 0.1,
    "reg_lambda"        : 1.0,
    "scale_pos_weight"  : spw,
    "use_label_encoder" : False,
    "eval_metric"       : "aucpr",
    "tree_method"       : "hist",
    "random_state"      : 42,
    "n_jobs"            : -1,
}

xgb_model = xgb.XGBClassifier(**xgb_params)
xgb_model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=False,
)

xgb_pred_proba = xgb_model.predict_proba(X_test)[:, 1]
xgb_pred       = (xgb_pred_proba >= 0.40).astype(int)   # lower threshold given imbalance

roc_auc = roc_auc_score(y_test, xgb_pred_proba)
pr_auc  = average_precision_score(y_test, xgb_pred_proba)
f1      = f1_score(y_test, xgb_pred)
prec    = precision_score(y_test, xgb_pred)
rec     = recall_score(y_test, xgb_pred)

print(f"   OK  XGBoost trained")
print(f"       ROC-AUC : {roc_auc:.4f}")
print(f"       PR-AUC  : {pr_auc:.4f}")
print(f"       F1      : {f1:.4f}  (P={prec:.3f}, R={rec:.3f})")

# ─────────────────────────────────────────────────
#  3b.  ISOLATION FOREST (trained on normals only)
# ─────────────────────────────────────────────────
print("\n   [3b] Training Isolation Forest ...")

scaler = StandardScaler()
X_normals = X_train[y_train == 0]
X_normals_scaled = scaler.fit_transform(X_normals)
X_test_scaled    = scaler.transform(X_test)

iso_forest = IsolationForest(
    n_estimators=200,
    contamination=0.07,
    max_samples="auto",
    random_state=42,
    n_jobs=-1,
)
iso_forest.fit(X_normals_scaled)

# Isolation Forest scores: more negative = more anomalous
iso_scores_raw = iso_forest.decision_function(X_test_scaled)   # lower = worse
# Normalise to [0, 1] — anomaly score
iso_min, iso_max = iso_scores_raw.min(), iso_scores_raw.max()
iso_anom_score = 1.0 - (iso_scores_raw - iso_min) / (iso_max - iso_min + 1e-9)

iso_pred = (iso_forest.predict(X_test_scaled) == -1).astype(int)
iso_roc  = roc_auc_score(y_test, iso_anom_score)
iso_pr   = average_precision_score(y_test, iso_anom_score)
iso_f1   = f1_score(y_test, iso_pred)

print(f"   OK  Isolation Forest trained on {len(X_normals):,} normals")
print(f"       ROC-AUC : {iso_roc:.4f}")
print(f"       PR-AUC  : {iso_pr:.4f}")
print(f"       F1      : {iso_f1:.4f}")

# ─────────────────────────────────────────────────
#  3c.  HYBRID RISK SCORE (matches data generator formula)
# ─────────────────────────────────────────────────
print("\n   [3c] Computing Hybrid Risk Score on test set ...")

# Network risk from test trades (already in features, but recalculate from raw df)
X_test_raw = df.loc[X_test.index, FEATURE_COLS].copy()

hybrid_risk = np.clip(
    100 * (
        0.45 * xgb_pred_proba +
        0.30 * iso_anom_score +
        0.15 * xgb_pred_proba +   # rule_engine_score proxy = xgb prob
        0.10 * X_test_raw["network_risk"].values
    ),
    0, 100
)

# Severity labels
def severity_label(scores):
    out = np.full(len(scores), "Low", dtype=object)
    out[scores >= 40] = "Medium"
    out[scores >= 70] = "High"
    out[scores >= 85] = "Critical"
    return out

hybrid_severity = severity_label(hybrid_risk)
print(f"   Severity distribution (test set):")
for s in ["Low", "Medium", "High", "Critical"]:
    n = (hybrid_severity == s).sum()
    print(f"     {s:<10}: {n:>5,}  ({n/len(hybrid_risk)*100:5.1f}%)")

# ─────────────────────────────────────────────────
#  4.  SHAP EXPLAINABILITY
# ─────────────────────────────────────────────────
print("\n[4/5] Computing SHAP values ...")

# Use a background sample for SHAP (faster)
bg_sample = X_train.sample(min(500, len(X_train)), random_state=42)

explainer   = shap.TreeExplainer(xgb_model, data=bg_sample, feature_perturbation="interventional")
shap_values = explainer(X_test.sample(min(2000, len(X_test)), random_state=42))

# Top features by mean |SHAP|
shap_mean_abs = np.abs(shap_values.values).mean(axis=0)
feat_importance = pd.Series(shap_mean_abs, index=FEATURE_COLS).sort_values(ascending=False)

print(f"   OK  SHAP values computed")
print(f"   Top 10 Features by Mean |SHAP|:")
for i, (feat, val) in enumerate(feat_importance.head(10).items()):
    bar = "█" * int(val * 40 / feat_importance.iloc[0])
    print(f"     {i+1:>2}. {feat:<35} {val:>6.4f}  {bar}")

# ─────────────────────────────────────────────────
#  5.  SAVE ARTIFACTS
# ─────────────────────────────────────────────────
print("\n[5/5] Saving model artifacts ...")

# XGBoost
xgb_model.save_model(str(MODELS_DIR / "xgb_model.json"))
print(f"   OK  xgb_model.json")

# Isolation Forest + Scaler
with open(MODELS_DIR / "iso_forest.pkl", "wb") as f:
    pickle.dump(iso_forest, f)
with open(MODELS_DIR / "scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)
print(f"   OK  iso_forest.pkl  +  scaler.pkl")

# SHAP Explainer
with open(MODELS_DIR / "shap_explainer.pkl", "wb") as f:
    pickle.dump(explainer, f)
print(f"   OK  shap_explainer.pkl")

# Feature columns (ordered)
with open(MODELS_DIR / "feature_columns.json", "w") as f:
    json.dump(FEATURE_COLS, f, indent=2)
print(f"   OK  feature_columns.json")

# Model metadata
meta = {
    "version"              : "1.0",
    "trained_on"           : str(pd.Timestamp.now().date()),
    "n_train"              : int(len(X_train)),
    "n_test"               : int(len(X_test)),
    "anomaly_rate_train"   : float(y_train.mean()),
    "scale_pos_weight"     : float(spw),
    "xgb_threshold"        : 0.40,
    "xgb_roc_auc"          : float(roc_auc),
    "xgb_pr_auc"           : float(pr_auc),
    "xgb_f1"               : float(f1),
    "xgb_precision"        : float(prec),
    "xgb_recall"           : float(rec),
    "iso_roc_auc"          : float(iso_roc),
    "iso_pr_auc"           : float(iso_pr),
    "iso_f1"               : float(iso_f1),
    "risk_weights"         : {"fraud": 0.45, "anomaly": 0.30, "rule": 0.15, "network": 0.10},
    "feature_columns"      : FEATURE_COLS,
    "top_shap_features"    : feat_importance.head(10).index.tolist(),
}
with open(MODELS_DIR / "model_metadata.json", "w") as f:
    json.dump(meta, f, indent=2)
print(f"   OK  model_metadata.json")

# ─────────────────────────────────────────────────
#  FINAL SUMMARY
# ─────────────────────────────────────────────────
print("\n" + "=" * 65)
print("  TRAINING COMPLETE")
print("=" * 65)
print(f"\n  XGBoost Classifier")
print(f"    ROC-AUC  : {roc_auc:.4f}")
print(f"    PR-AUC   : {pr_auc:.4f}")
print(f"    F1-Score : {f1:.4f}  (P={prec:.3f}  R={rec:.3f})")
print(f"\n  Isolation Forest")
print(f"    ROC-AUC  : {iso_roc:.4f}")
print(f"    PR-AUC   : {iso_pr:.4f}")
print(f"    F1-Score : {iso_f1:.4f}")
print(f"\n  Saved to  : {MODELS_DIR}")
for f in sorted(MODELS_DIR.iterdir()):
    kb = f.stat().st_size / 1024
    print(f"    {f.name:<35} {kb:>8.1f} KB")
print("\n  Top SHAP Features:")
for i, feat in enumerate(feat_importance.head(5).index, 1):
    print(f"    {i}. {feat}")
print("\n" + "=" * 65)
print("  DONE! Models ready for FastAPI inference.")
print("=" * 65)
