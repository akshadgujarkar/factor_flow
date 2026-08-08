"""
=============================================================================
  INSIDER TRADING DETECTOR — Time-Based Split Validation
  Purpose: Verify XGBoost is not benefiting from future data leakage.
  Splits data on 2026-07-01 (train = before, test = after).
  Does NOT overwrite the existing saved models.
=============================================================================
"""

import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_auc_score, average_precision_score,
    f1_score, precision_score, recall_score,
)
import xgboost as xgb

warnings.filterwarnings("ignore")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).parent.parent   # ml_backend/
DATA_DIR = BASE_DIR / "data"

print("=" * 65)
print("  TIME-BASED SPLIT VALIDATION")
print("=" * 65)

# =============================================================================
#  1. LOAD + FEATURE ENGINEERING  (mirrors train_model.py exactly)
# =============================================================================
print("\n[1/4] Loading & engineering features ...")

df = pd.read_csv(DATA_DIR / "trades.csv", parse_dates=["trade_timestamp"])

# -- Engineered time features
df["hour_of_day"] = df["trade_timestamp"].dt.hour
df["day_of_week"] = df["trade_timestamp"].dt.dayofweek
df["is_weekend"]  = (df["day_of_week"] >= 5).astype(int)
df["month"]       = df["trade_timestamp"].dt.month

# -- Cap sentinel values
df["hours_to_next_event"]    = df["hours_to_next_event"].clip(upper=500)
df["hours_since_last_event"] = df["hours_since_last_event"].clip(upper=500)

# -- Cast bool-ish columns
for c in ["is_pre_event_window", "unusual_instrument_flag",
          "after_hours_flag", "is_anomalous"]:
    df[c] = df[c].astype(int)

# -- Categorical encodings
df["action_buy"]         = (df["action"]     == "BUY").astype(int)
df["instrument_options"] = (df["instrument"] == "Options").astype(int)
df["instrument_futures"] = (df["instrument"] == "Futures").astype(int)
df["order_market"]       = (df["order_type"] == "Market").astype(int)

# -- Log transforms
df["log_trade_value"] = np.log1p(df["trade_value"])
df["log_quantity"]    = np.log1p(df["quantity"])
df["log_price"]       = np.log1p(df["price"])

FEATURE_COLS = [
    "volume_ratio", "volume_zscore_30d",
    "hours_to_next_event", "hours_since_last_event", "is_pre_event_window",
    "peer_group_deviation", "buy_sell_ratio", "unusual_instrument_flag",
    "after_hours_flag", "consecutive_profitable_trades",
    "price_impact_proxy", "network_risk",
    "trade_frequency_1h", "trade_frequency_24h",
    "pnl_pct",
    "hour_of_day", "day_of_week", "is_weekend", "month",
    "action_buy", "instrument_options", "instrument_futures", "order_market",
    "log_trade_value", "log_quantity", "log_price",
]
TARGET = "is_anomalous"

print(f"   OK  {len(df):,} trades loaded  |  {len(FEATURE_COLS)} features")

# =============================================================================
#  2. TIME-BASED SPLIT
# =============================================================================
print("\n[2/4] Applying time-based split ...")

df = df.sort_values("trade_timestamp")

SPLIT_DATE = "2026-07-01"
train = df[df["trade_timestamp"] <  SPLIT_DATE]
test  = df[df["trade_timestamp"] >= SPLIT_DATE]

if len(test) == 0:
    # Data is synthetic 2023-2024, so fall back to a sensible cut point
    SPLIT_DATE = "2024-07-01"
    train = df[df["trade_timestamp"] <  SPLIT_DATE]
    test  = df[df["trade_timestamp"] >= SPLIT_DATE]

X_train = train[FEATURE_COLS].fillna(0)
y_train = train[TARGET]
X_test  = test[FEATURE_COLS].fillna(0)
y_test  = test[TARGET]

print(f"   Split date : {SPLIT_DATE}")
print(f"   Train      : {len(X_train):,} trades  "
      f"| anomaly rate: {y_train.mean()*100:.1f}%"
      f"  ({y_train.sum():,} anomalies)")
print(f"   Test       : {len(X_test):,} trades  "
      f"| anomaly rate: {y_test.mean()*100:.1f}%"
      f"  ({y_test.sum():,} anomalies)")

if y_train.sum() == 0 or y_test.sum() == 0:
    print("\n  [!] One split has no anomalies — cannot compute metrics.")
    print("      Try adjusting SPLIT_DATE above.")
    sys.exit(1)

# =============================================================================
#  3. TRAIN XGBOOST ON TIME-BASED TRAIN SET
# =============================================================================
print("\n[3/4] Training XGBoost on time-based train split ...")

n_neg = (y_train == 0).sum()
n_pos = (y_train == 1).sum()
spw   = round(n_neg / n_pos, 2)
print(f"   scale_pos_weight : {spw}  (neg={n_neg:,}  pos={n_pos:,})")

xgb_model = xgb.XGBClassifier(
    n_estimators      = 400,
    max_depth         = 6,
    learning_rate     = 0.05,
    subsample         = 0.8,
    colsample_bytree  = 0.8,
    min_child_weight  = 5,
    gamma             = 1.0,
    reg_alpha         = 0.1,
    reg_lambda        = 1.0,
    scale_pos_weight  = spw,
    eval_metric       = "aucpr",
    tree_method       = "hist",
    random_state      = 42,
    n_jobs            = -1,
)
xgb_model.fit(X_train, y_train, verbose=False)

proba  = xgb_model.predict_proba(X_test)[:, 1]
pred   = (proba >= 0.40).astype(int)

roc    = roc_auc_score(y_test, proba)
pr     = average_precision_score(y_test, proba)
f1     = f1_score(y_test, pred)
prec   = precision_score(y_test, pred)
rec    = recall_score(y_test, pred)

print(f"   OK  XGBoost trained")

# =============================================================================
#  4. COMPARISON REPORT
# =============================================================================
print("\n[4/4] Results")

# Original (random-split) metrics from model_metadata.json
import json
meta_path = BASE_DIR / "models" / "model_metadata.json"
orig = {}
if meta_path.exists():
    with open(meta_path) as f:
        orig = json.load(f)

orig_roc = orig.get("xgb_roc_auc", None)
orig_pr  = orig.get("xgb_pr_auc",  None)
orig_f1  = orig.get("xgb_f1",      None)

print()
print("=" * 65)
print("  VALIDATION REPORT")
print("=" * 65)
print(f"  {'Metric':<20} {'Random split':>14}  {'Time split':>12}  {'Delta':>8}")
print("  " + "-" * 58)

def delta_str(new, old):
    if old is None:
        return "    n/a"
    d = new - old
    sign = "+" if d >= 0 else ""
    return f"  {sign}{d:+.4f}"

print(f"  {'ROC-AUC':<20} {str(round(orig_roc,4)) if orig_roc else 'n/a':>14}  "
      f"{roc:>12.4f}  {delta_str(roc, orig_roc)}")
print(f"  {'PR-AUC':<20} {str(round(orig_pr,4)) if orig_pr else 'n/a':>14}  "
      f"{pr:>12.4f}  {delta_str(pr, orig_pr)}")
print(f"  {'F1-Score':<20} {str(round(orig_f1,4)) if orig_f1 else 'n/a':>14}  "
      f"{f1:>12.4f}  {delta_str(f1, orig_f1)}")
print(f"  {'Precision':<20} {'n/a':>14}  {prec:>12.4f}")
print(f"  {'Recall':<20} {'n/a':>14}  {rec:>12.4f}")
print("=" * 65)

print()
if roc >= 0.95 and pr >= 0.80:
    print("  VERDICT: Model generalises well to unseen future data.")
    print("           No evidence of temporal data leakage.")
elif roc >= 0.80:
    print("  VERDICT: Modest drop — some leakage or distribution shift.")
    print("           Consider re-generating data with stricter isolation.")
else:
    print("  VERDICT: Significant performance drop detected.")
    print("           The random-split score was likely inflated by leakage.")
print()
print("  NOTE: Existing saved models were NOT modified by this script.")
print("=" * 65)
