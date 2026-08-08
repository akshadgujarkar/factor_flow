"""
=============================================================================
 INSIDER TRADING & FRAUDULENT BEHAVIOUR DETECTOR
 Model Evaluation  —  Step 4  (v1.0)

 Loads: models/xgb_model.json, iso_forest.pkl, scaler.pkl,
        shap_explainer.pkl, feature_columns.json
 Evaluates on:  trades.csv  (same 80/20 stratified split as training)
 Outputs:
   artifacts/01_xgb_confusion_matrix.png
   artifacts/02_xgb_roc_curve.png
   artifacts/03_xgb_pr_curve.png
   artifacts/04_iso_roc_curve.png
   artifacts/05_shap_summary_bar.png
   artifacts/06_shap_waterfall.png
   artifacts/evaluation_report.txt
=============================================================================
"""

# ── Standard library ──────────────────────────────────────────────────────
import json
import pickle
import sys
import textwrap
import warnings
from datetime import datetime
from pathlib import Path

# ── Third-party ───────────────────────────────────────────────────────────
import matplotlib
matplotlib.use("Agg")          # headless — no display required
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.colors import LinearSegmentedColormap
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ─────────────────────────────────────────────────────────────────────────
#  CONSTANTS  (must mirror train_model.py exactly)
# ─────────────────────────────────────────────────────────────────────────
RANDOM_STATE  = 42
TEST_SIZE     = 0.20
XGB_THRESHOLD = 0.40          # classification cut-off used during training
ISO_NORM_MIN  = -0.5          # conservative normalisation constants
ISO_NORM_RANGE = 1.0

RISK_W = dict(fraud=0.45, anomaly=0.30, rule=0.15, network=0.10)
SEVERITY_THRESHOLDS = {"Low": 0, "Medium": 40, "High": 70, "Critical": 85}

# Palette
CLR_PRIMARY   = "#6C63FF"
CLR_SECONDARY = "#FF6584"
CLR_SUCCESS   = "#43AA8B"
CLR_WARN      = "#F9C74F"
CLR_DANGER    = "#F94144"
CLR_BG        = "#0F1117"
CLR_SURFACE   = "#1C1F2E"
CLR_TEXT      = "#E8E8F0"
CLR_MUTED     = "#6B7280"

# ─────────────────────────────────────────────────────────────────────────
#  PATHS
# ─────────────────────────────────────────────────────────────────────────
BASE_DIR      = Path(__file__).parent
DATA_DIR      = BASE_DIR / "data"
MODELS_DIR    = BASE_DIR / "models"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
ARTIFACTS_DIR.mkdir(exist_ok=True)

REPORT_PATH   = ARTIFACTS_DIR / "evaluation_report.txt"


# ═════════════════════════════════════════════════════════════════════════
#  SECTION 1 — DATA LOADING & FEATURE ENGINEERING
#  Exactly mirrors train_model.py so the test split is identical.
# ═════════════════════════════════════════════════════════════════════════
def load_and_engineer(data_dir: Path, feature_columns: list) -> tuple:
    """
    Load trades.csv, apply the same feature engineering as training,
    and return (X_test, y_test) using the identical random split.
    """
    df = pd.read_csv(data_dir / "trades.csv", parse_dates=["trade_timestamp"])

    # Time-based
    df["hour_of_day"]  = df["trade_timestamp"].dt.hour
    df["day_of_week"]  = df["trade_timestamp"].dt.dayofweek
    df["is_weekend"]   = (df["day_of_week"] >= 5).astype(int)
    df["month"]        = df["trade_timestamp"].dt.month

    # Cap sentinels
    df["hours_to_next_event"]    = df["hours_to_next_event"].clip(upper=500)
    df["hours_since_last_event"] = df["hours_since_last_event"].clip(upper=500)

    # Bool → int
    for c in ["is_pre_event_window", "unusual_instrument_flag",
              "after_hours_flag", "is_anomalous"]:
        df[c] = df[c].astype(int)

    # Encodings
    df["action_buy"]          = (df["action"]     == "BUY").astype(int)
    df["instrument_options"]  = (df["instrument"] == "Options").astype(int)
    df["instrument_futures"]  = (df["instrument"] == "Futures").astype(int)
    df["order_market"]        = (df["order_type"] == "Market").astype(int)

    # Log transforms
    df["log_trade_value"] = np.log1p(df["trade_value"])
    df["log_quantity"]    = np.log1p(df["quantity"])
    df["log_price"]       = np.log1p(df["price"])

    X = df[feature_columns].fillna(df[feature_columns].median())
    y = df["is_anomalous"]

    _, X_test, _, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )
    return X_test, y_test


# ═════════════════════════════════════════════════════════════════════════
#  SECTION 2 — LOAD MODEL ARTIFACTS
# ═════════════════════════════════════════════════════════════════════════
def load_artifacts(models_dir: Path) -> dict:
    """Load all saved model artifacts and return as a dict."""
    artifacts = {}

    # XGBoost
    xgb_model = xgb.XGBClassifier()
    xgb_model.load_model(str(models_dir / "xgb_model.json"))
    artifacts["xgb_model"] = xgb_model

    # Isolation Forest + Scaler
    with open(models_dir / "iso_forest.pkl", "rb") as f:
        artifacts["iso_forest"] = pickle.load(f)
    with open(models_dir / "scaler.pkl", "rb") as f:
        artifacts["scaler"] = pickle.load(f)

    # SHAP explainer
    with open(models_dir / "shap_explainer.pkl", "rb") as f:
        artifacts["shap_explainer"] = pickle.load(f)

    # Feature list + metadata
    with open(models_dir / "feature_columns.json") as f:
        artifacts["feature_columns"] = json.load(f)
    with open(models_dir / "model_metadata.json") as f:
        artifacts["metadata"] = json.load(f)

    return artifacts


# ═════════════════════════════════════════════════════════════════════════
#  SECTION 3 — INFERENCE
# ═════════════════════════════════════════════════════════════════════════
def run_inference(artifacts: dict, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    """
    Run XGBoost + Isolation Forest on the test set.
    Returns a dict of all scores, predictions, and derived metrics.
    """
    xgb_model  = artifacts["xgb_model"]
    iso_forest = artifacts["iso_forest"]
    scaler     = artifacts["scaler"]

    # ── XGBoost ──────────────────────────────────────────────────────────
    xgb_proba = xgb_model.predict_proba(X_test)[:, 1]
    xgb_pred  = (xgb_proba >= XGB_THRESHOLD).astype(int)

    # ── Isolation Forest ─────────────────────────────────────────────────
    X_scaled  = scaler.transform(X_test)
    iso_raw   = iso_forest.decision_function(X_scaled)          # lower = more anomalous
    # Normalise using training-time constants (conservative fixed range)
    iso_score = np.clip(1.0 - (iso_raw - ISO_NORM_MIN) / ISO_NORM_RANGE, 0.0, 1.0)
    iso_pred  = (iso_forest.predict(X_scaled) == -1).astype(int)

    # ── Hybrid risk score ─────────────────────────────────────────────────
    net_risk   = X_test["network_risk"].values
    hybrid     = np.clip(
        100 * (
            RISK_W["fraud"]   * xgb_proba  +
            RISK_W["anomaly"] * iso_score  +
            RISK_W["rule"]    * xgb_proba  +   # rule proxy = XGB
            RISK_W["network"] * net_risk
        ),
        0, 100,
    )

    return dict(
        # raw
        xgb_proba=xgb_proba,
        xgb_pred=xgb_pred,
        iso_score=iso_score,
        iso_pred=iso_pred,
        hybrid_risk=hybrid,
        y_test=y_test,
        X_test=X_test,
    )


# ═════════════════════════════════════════════════════════════════════════
#  SECTION 4 — METRICS
# ═════════════════════════════════════════════════════════════════════════
def compute_metrics(results: dict) -> dict:
    """Compute all evaluation metrics for both models."""
    y   = results["y_test"]
    xp  = results["xgb_pred"]
    xpr = results["xgb_proba"]
    ip  = results["iso_pred"]
    isc = results["iso_score"]

    def _metrics(y_true, y_pred, y_score):
        return dict(
            accuracy  = accuracy_score(y_true, y_pred),
            precision = precision_score(y_true, y_pred, zero_division=0),
            recall    = recall_score(y_true, y_pred, zero_division=0),
            f1        = f1_score(y_true, y_pred, zero_division=0),
            roc_auc   = roc_auc_score(y_true, y_score),
            pr_auc    = average_precision_score(y_true, y_score),
            cm        = confusion_matrix(y_true, y_pred),
            report    = classification_report(y_true, y_pred,
                            target_names=["Normal", "Anomalous"],
                            zero_division=0),
        )

    xgb_m = _metrics(y, xp,  xpr)
    iso_m = _metrics(y, ip,  isc)

    # ROC curve points (used for plotting)
    xgb_fpr, xgb_tpr, _ = roc_curve(y, xpr)
    iso_fpr, iso_tpr, _ = roc_curve(y, isc)
    xgb_prec_c, xgb_rec_c, _ = precision_recall_curve(y, xpr)

    return dict(
        xgb=xgb_m, iso=iso_m,
        xgb_roc=(xgb_fpr, xgb_tpr),
        iso_roc=(iso_fpr, iso_tpr),
        xgb_pr=(xgb_prec_c, xgb_rec_c),
    )


# ═════════════════════════════════════════════════════════════════════════
#  SECTION 5 — PLOTTING UTILITIES
# ═════════════════════════════════════════════════════════════════════════
def _apply_dark_style(fig: plt.Figure, ax_list: list):
    """Apply consistent dark theme to a figure and its axes."""
    fig.patch.set_facecolor(CLR_BG)
    for ax in ax_list:
        ax.set_facecolor(CLR_SURFACE)
        ax.tick_params(colors=CLR_TEXT, labelsize=9)
        ax.xaxis.label.set_color(CLR_TEXT)
        ax.yaxis.label.set_color(CLR_TEXT)
        ax.title.set_color(CLR_TEXT)
        for spine in ax.spines.values():
            spine.set_edgecolor(CLR_MUTED)
            spine.set_linewidth(0.6)


def _save(fig: plt.Figure, path: Path):
    fig.savefig(path, dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"   saved  →  {path.name}")


# ── Plot 1: Confusion Matrix ──────────────────────────────────────────────
def plot_confusion_matrix(cm: np.ndarray, title: str, path: Path):
    fig, ax = plt.subplots(figsize=(5, 4))
    _apply_dark_style(fig, [ax])

    cmap = LinearSegmentedColormap.from_list(
        "custom", [CLR_SURFACE, CLR_PRIMARY], N=256
    )
    im = ax.imshow(cm, cmap=cmap, aspect="auto")
    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

    labels = ["Normal", "Anomalous"]
    ax.set_xticks([0, 1]); ax.set_xticklabels(labels)
    ax.set_yticks([0, 1]); ax.set_yticklabels(labels)
    ax.set_xlabel("Predicted", fontsize=10)
    ax.set_ylabel("Actual",    fontsize=10)
    ax.set_title(title,        fontsize=12, fontweight="bold", pad=12)

    total = cm.sum()
    for i in range(2):
        for j in range(2):
            val  = cm[i, j]
            pct  = f"\n({val/total*100:.1f}%)"
            cell_color = CLR_BG if cm[i, j] > cm.max() / 2 else CLR_TEXT
            ax.text(j, i, f"{val:,}{pct}",
                    ha="center", va="center",
                    color=cell_color, fontsize=11, fontweight="bold")

    fig.tight_layout()
    _save(fig, path)


# ── Plot 2 & 4: ROC Curve ─────────────────────────────────────────────────
def plot_roc(fpr, tpr, auc_val: float, label: str, color: str, path: Path):
    fig, ax = plt.subplots(figsize=(5.5, 4.5))
    _apply_dark_style(fig, [ax])

    ax.plot(fpr, tpr, color=color,  lw=2,
            label=f"{label}  (AUC = {auc_val:.4f})")
    ax.plot([0, 1], [0, 1], "--", color=CLR_MUTED, lw=1, label="Random")
    ax.fill_between(fpr, tpr, alpha=0.12, color=color)

    ax.set_xlim([0, 1]); ax.set_ylim([0, 1.02])
    ax.set_xlabel("False Positive Rate", fontsize=10)
    ax.set_ylabel("True Positive Rate",  fontsize=10)
    ax.set_title(f"ROC Curve — {label}", fontsize=12, fontweight="bold", pad=12)
    ax.legend(loc="lower right", fontsize=9,
              facecolor=CLR_SURFACE, edgecolor=CLR_MUTED,
              labelcolor=CLR_TEXT)

    # Annotation at elbow
    idx = np.argmax(tpr - fpr)
    ax.annotate(f"  ({fpr[idx]:.2f}, {tpr[idx]:.2f})",
                xy=(fpr[idx], tpr[idx]),
                color=CLR_WARN, fontsize=8,
                arrowprops=dict(arrowstyle="->", color=CLR_WARN, lw=1),
                xytext=(fpr[idx] + 0.12, tpr[idx] - 0.08))
    ax.scatter([fpr[idx]], [tpr[idx]], color=CLR_WARN, zorder=5, s=40)

    fig.tight_layout()
    _save(fig, path)


# ── Plot 3: Precision-Recall Curve ───────────────────────────────────────
def plot_pr_curve(precision_pts, recall_pts, pr_auc: float, path: Path):
    fig, ax = plt.subplots(figsize=(5.5, 4.5))
    _apply_dark_style(fig, [ax])

    ax.plot(recall_pts, precision_pts, color=CLR_SUCCESS, lw=2,
            label=f"XGBoost  (AP = {pr_auc:.4f})")
    ax.fill_between(recall_pts, precision_pts, alpha=0.12, color=CLR_SUCCESS)

    # Baseline (random classifier)
    baseline = float(np.mean(precision_pts[-1]))   # approx anomaly rate
    ax.axhline(baseline, linestyle="--", color=CLR_MUTED, lw=1,
               label=f"Baseline (random)  ≈ {baseline:.3f}")

    # Mark operating threshold
    ax.set_xlabel("Recall",    fontsize=10)
    ax.set_ylabel("Precision", fontsize=10)
    ax.set_title("Precision-Recall Curve — XGBoost", fontsize=12,
                 fontweight="bold", pad=12)
    ax.set_xlim([0, 1]); ax.set_ylim([0, 1.05])
    ax.legend(fontsize=9, facecolor=CLR_SURFACE,
              edgecolor=CLR_MUTED, labelcolor=CLR_TEXT)

    fig.tight_layout()
    _save(fig, path)


# ── Plot 5: SHAP Summary Bar ──────────────────────────────────────────────
def plot_shap_bar(shap_values, feature_columns: list, path: Path):
    """
    Horizontal bar chart of mean |SHAP| values for each feature,
    colour-coded by feature group.
    """
    mean_abs = np.abs(shap_values.values).mean(axis=0)
    feat_imp = (
        pd.DataFrame({"feature": feature_columns, "shap": mean_abs})
        .sort_values("shap", ascending=True)   # ascending for horizontal plot
        .tail(15)                               # top 15
    )

    # Assign colours by group
    GROUP_COLOURS = {
        "volume": CLR_PRIMARY,
        "hours":  CLR_SUCCESS,
        "is_pre": CLR_WARN,
        "peer":   CLR_SECONDARY,
        "pnl":    CLR_DANGER,
        "log":    "#A78BFA",
        "after":  "#34D399",
        "network":"#FCA5A5",
    }
    def _colour(name):
        for key, clr in GROUP_COLOURS.items():
            if name.startswith(key):
                return clr
        return CLR_MUTED

    colours = [_colour(f) for f in feat_imp["feature"]]

    fig, ax = plt.subplots(figsize=(7, 5.5))
    _apply_dark_style(fig, [ax])

    bars = ax.barh(feat_imp["feature"], feat_imp["shap"],
                   color=colours, height=0.65, edgecolor="none")

    # Value labels
    for bar, val in zip(bars, feat_imp["shap"]):
        ax.text(bar.get_width() + feat_imp["shap"].max() * 0.01,
                bar.get_y() + bar.get_height() / 2,
                f"{val:.4f}", va="center", color=CLR_TEXT, fontsize=8)

    ax.set_xlabel("Mean |SHAP value|", fontsize=10)
    ax.set_title("Feature Importance — SHAP (Top 15)", fontsize=12,
                 fontweight="bold", pad=12)
    ax.set_xlim(0, feat_imp["shap"].max() * 1.18)
    ax.tick_params(axis="y", labelsize=8.5)

    fig.tight_layout()
    _save(fig, path)


# ── Plot 6: SHAP Waterfall (single highest-risk trade) ───────────────────
def plot_shap_waterfall(shap_values, X_sample: pd.DataFrame,
                        results: dict, path: Path):
    """
    Waterfall plot for the single trade with the highest hybrid risk score
    in the anomalous test set.
    """
    # Find the index within X_sample that corresponds to the highest-risk anomalous trade
    hybrid_risk = results["hybrid_risk"]
    y_test      = results["y_test"]
    X_test      = results["X_test"]

    anom_mask    = y_test.values == 1
    anom_indices = np.where(anom_mask)[0]
    if len(anom_indices) == 0:
        print("   WARN  No anomalous trades found — skipping waterfall")
        return

    # Find highest-risk anomalous trade index (in X_test order)
    top_idx_in_test = anom_indices[np.argmax(hybrid_risk[anom_mask])]

    # Map to X_sample row (X_sample was drawn from X_test)
    test_ids = list(X_test.index)
    sample_ids = list(X_sample.index)
    # Find nearest available sample row for the waterfall
    if top_idx_in_test < len(shap_values):
        waterfall_idx = top_idx_in_test
    else:
        waterfall_idx = 0   # fallback

    fig, ax = plt.subplots(figsize=(8, 5.5))
    _apply_dark_style(fig, [ax])

    shap.waterfall_plot(
        shap_values[waterfall_idx],
        max_display=12,
        show=False,
    )

    # Style the generated figure (shap creates its own axis)
    current_fig = plt.gcf()
    current_fig.patch.set_facecolor(CLR_BG)
    for axes in current_fig.get_axes():
        axes.set_facecolor(CLR_SURFACE)
        axes.tick_params(colors=CLR_TEXT, labelsize=8.5)
        axes.xaxis.label.set_color(CLR_TEXT)
        axes.yaxis.label.set_color(CLR_TEXT)
        for spine in axes.spines.values():
            spine.set_edgecolor(CLR_MUTED)

    current_fig.suptitle(
        "SHAP Waterfall — Highest-Risk Anomalous Trade",
        fontsize=11, fontweight="bold", color=CLR_TEXT, y=1.01
    )
    current_fig.savefig(path, dpi=150, bbox_inches="tight",
                        facecolor=current_fig.get_facecolor())
    plt.close(current_fig)
    plt.close(fig)
    print(f"   saved  →  {path.name}")


# ═════════════════════════════════════════════════════════════════════════
#  SECTION 6 — TEXT REPORT
# ═════════════════════════════════════════════════════════════════════════
def write_report(metrics: dict, results: dict,
                 metadata: dict, feature_columns: list,
                 output_path: Path):
    """Write a human-readable evaluation_report.txt."""
    xm = metrics["xgb"]
    im = metrics["iso"]
    hr = results["hybrid_risk"]
    y  = results["y_test"].values

    # Severity breakdown on test set
    def _sev(score):
        if score >= 85: return "Critical"
        if score >= 70: return "High"
        if score >= 40: return "Medium"
        return "Low"

    sev_labels = np.array([_sev(s) for s in hr])
    sev_counts = {s: (sev_labels == s).sum() for s in ["Low","Medium","High","Critical"]}
    n = len(y)

    # SHAP top features from metadata
    top_shap = metadata.get("top_shap_features", feature_columns[:5])

    lines = [
        "=" * 68,
        "  INSIDER TRADING DETECTOR — MODEL EVALUATION REPORT",
        f"  Generated : {datetime.now().strftime('%Y-%m-%d  %H:%M:%S')}",
        f"  Model ver : {metadata.get('version', 'N/A')}  "
        f"| Trained on: {metadata.get('trained_on', 'N/A')}",
        "=" * 68,
        "",
        "─" * 68,
        "  1.  TEST SET OVERVIEW",
        "─" * 68,
        f"  Total trades   : {n:,}",
        f"  Anomalies      : {y.sum():,}  ({y.mean()*100:.2f}%)",
        f"  Normal trades  : {(1-y).sum():,}  ({(1-y).mean()*100:.2f}%)",
        f"  XGB threshold  : {XGB_THRESHOLD}",
        "",
        "─" * 68,
        "  2.  XGBOOST CLASSIFIER",
        "─" * 68,
        f"  Accuracy   : {xm['accuracy']:.4f}",
        f"  Precision  : {xm['precision']:.4f}",
        f"  Recall     : {xm['recall']:.4f}",
        f"  F1-Score   : {xm['f1']:.4f}",
        f"  ROC-AUC    : {xm['roc_auc']:.4f}",
        f"  PR-AUC     : {xm['pr_auc']:.4f}",
        "",
        "  Confusion Matrix:",
        "                      Pred Normal   Pred Anomalous",
        f"  Actual Normal    :  {xm['cm'][0,0]:>10,}   {xm['cm'][0,1]:>14,}",
        f"  Actual Anomalous :  {xm['cm'][1,0]:>10,}   {xm['cm'][1,1]:>14,}",
        "",
        "  Classification Report:",
    ] + [f"    {l}" for l in xm["report"].splitlines()] + [
        "",
        "─" * 68,
        "  3.  ISOLATION FOREST",
        "─" * 68,
        f"  Accuracy   : {im['accuracy']:.4f}",
        f"  Precision  : {im['precision']:.4f}",
        f"  Recall     : {im['recall']:.4f}",
        f"  F1-Score   : {im['f1']:.4f}",
        f"  ROC-AUC    : {im['roc_auc']:.4f}",
        f"  PR-AUC     : {im['pr_auc']:.4f}",
        "",
        "  Confusion Matrix:",
        "                      Pred Normal   Pred Anomalous",
        f"  Actual Normal    :  {im['cm'][0,0]:>10,}   {im['cm'][0,1]:>14,}",
        f"  Actual Anomalous :  {im['cm'][1,0]:>10,}   {im['cm'][1,1]:>14,}",
        "",
        "─" * 68,
        "  4.  HYBRID RISK SCORE  (test set severity breakdown)",
        "─" * 68,
        f"  Risk formula:  100 × (0.45·XGB + 0.30·IsoForest + 0.15·Rule + 0.10·Network)",
        "",
    ] + [
        f"  {s:<10}: {c:>6,}  ({c/n*100:5.1f}%)"
        for s, c in sev_counts.items()
    ] + [
        "",
        "─" * 68,
        "  5.  TOP SHAP FEATURES (by mean |SHAP|)",
        "─" * 68,
    ] + [
        f"  {i+1:>2}. {feat}"
        for i, feat in enumerate(top_shap)
    ] + [
        "",
        "─" * 68,
        "  6.  ARTIFACTS GENERATED",
        "─" * 68,
        "  artifacts/01_xgb_confusion_matrix.png",
        "  artifacts/02_xgb_roc_curve.png",
        "  artifacts/03_xgb_pr_curve.png",
        "  artifacts/04_iso_roc_curve.png",
        "  artifacts/05_shap_summary_bar.png",
        "  artifacts/06_shap_waterfall.png",
        "  artifacts/evaluation_report.txt  ← this file",
        "",
        "─" * 68,
        "  7.  VERDICT",
        "─" * 68,
    ]

    # Verdict logic
    if xm["roc_auc"] >= 0.95 and xm["f1"] >= 0.80:
        verdict = "EXCELLENT — models are production-ready."
    elif xm["roc_auc"] >= 0.90 and xm["f1"] >= 0.70:
        verdict = "GOOD — consider threshold tuning or class-weight adjustment."
    else:
        verdict = "NEEDS IMPROVEMENT — revisit features or re-train."

    lines += [
        f"  XGBoost ROC-AUC: {xm['roc_auc']:.4f}  |  F1: {xm['f1']:.4f}",
        f"  Assessment: {verdict}",
        "",
        "=" * 68,
        "  END OF REPORT",
        "=" * 68,
    ]

    text = "\n".join(lines)
    output_path.write_text(text, encoding="utf-8")
    return text


# ═════════════════════════════════════════════════════════════════════════
#  SECTION 7 — SHAP COMPUTATION
# ═════════════════════════════════════════════════════════════════════════
def compute_shap(explainer, X_test: pd.DataFrame, n_samples: int = 2000):
    """Compute SHAP values on a random sample of the test set."""
    X_sample = X_test.sample(min(n_samples, len(X_test)), random_state=RANDOM_STATE)
    shap_values = explainer(X_sample)
    return shap_values, X_sample


# ═════════════════════════════════════════════════════════════════════════
#  MAIN
# ═════════════════════════════════════════════════════════════════════════
def main():
    print("=" * 65)
    print("  INSIDER TRADING DETECTOR  —  Model Evaluation  (Step 4)")
    print("=" * 65)

    # ── Guard: models must exist ──────────────────────────────────────────
    required = ["xgb_model.json", "iso_forest.pkl", "scaler.pkl",
                "shap_explainer.pkl", "feature_columns.json",
                "model_metadata.json"]
    missing = [f for f in required if not (MODELS_DIR / f).exists()]
    if missing:
        print("\n  ERROR: Missing model artifacts:")
        for f in missing:
            print(f"    ✗  models/{f}")
        print("\n  Run  python train_model.py  first, then re-run evaluation.")
        sys.exit(1)

    # ── Step 1: Load artifacts ────────────────────────────────────────────
    print("\n[1/6] Loading model artifacts ...")
    artifacts = load_artifacts(MODELS_DIR)
    feature_columns = artifacts["feature_columns"]
    metadata        = artifacts["metadata"]
    print(f"   OK  XGBoost v{xgb.__version__}  |  "
          f"{len(feature_columns)} features  |  "
          f"trained {metadata.get('trained_on','?')}")

    # ── Step 2: Rebuild test set ──────────────────────────────────────────
    print("\n[2/6] Rebuilding test split from trades.csv ...")
    X_test, y_test = load_and_engineer(DATA_DIR, feature_columns)
    print(f"   OK  {len(X_test):,} test trades  |  "
          f"anomaly rate: {y_test.mean()*100:.1f}%")

    # ── Step 3: Inference ─────────────────────────────────────────────────
    print("\n[3/6] Running inference ...")
    results = run_inference(artifacts, X_test, y_test)
    print(f"   OK  XGB flagged: "
          f"{results['xgb_pred'].sum():,}  |  "
          f"IsoForest flagged: {results['iso_pred'].sum():,}")

    # ── Step 4: Metrics ───────────────────────────────────────────────────
    print("\n[4/6] Computing metrics ...")
    metrics = compute_metrics(results)
    xm = metrics["xgb"]
    im = metrics["iso"]
    print(f"   XGBoost    →  ROC-AUC: {xm['roc_auc']:.4f}  "
          f"PR-AUC: {xm['pr_auc']:.4f}  F1: {xm['f1']:.4f}  "
          f"(P={xm['precision']:.3f}  R={xm['recall']:.3f})")
    print(f"   IsoForest  →  ROC-AUC: {im['roc_auc']:.4f}  "
          f"PR-AUC: {im['pr_auc']:.4f}  F1: {im['f1']:.4f}")

    # ── Step 5: SHAP ──────────────────────────────────────────────────────
    print("\n[5/6] Computing SHAP values (sample of 2,000 trades) ...")
    shap_values, X_sample = compute_shap(artifacts["shap_explainer"], X_test)
    shap_mean_abs = np.abs(shap_values.values).mean(axis=0)
    feat_imp = pd.Series(shap_mean_abs, index=feature_columns).sort_values(ascending=False)
    print(f"   OK  Top 5 features:")
    for i, (f, v) in enumerate(feat_imp.head(5).items(), 1):
        bar = "█" * int(v * 30 / feat_imp.iloc[0])
        print(f"     {i}. {f:<35} {v:.5f}  {bar}")

    # ── Step 6: Plots + Report ────────────────────────────────────────────
    print("\n[6/6] Generating plots & report ...")

    plot_confusion_matrix(
        xm["cm"],
        "XGBoost — Confusion Matrix",
        ARTIFACTS_DIR / "01_xgb_confusion_matrix.png",
    )
    plot_roc(
        *metrics["xgb_roc"], xm["roc_auc"],
        "XGBoost", CLR_PRIMARY,
        ARTIFACTS_DIR / "02_xgb_roc_curve.png",
    )
    plot_pr_curve(
        *metrics["xgb_pr"], xm["pr_auc"],
        ARTIFACTS_DIR / "03_xgb_pr_curve.png",
    )
    plot_roc(
        *metrics["iso_roc"], im["roc_auc"],
        "Isolation Forest", CLR_SECONDARY,
        ARTIFACTS_DIR / "04_iso_roc_curve.png",
    )
    plot_shap_bar(
        shap_values, feature_columns,
        ARTIFACTS_DIR / "05_shap_summary_bar.png",
    )
    plot_shap_waterfall(
        shap_values, X_sample, results,
        ARTIFACTS_DIR / "06_shap_waterfall.png",
    )

    report_text = write_report(
        metrics, results, metadata,
        feature_columns, REPORT_PATH
    )
    print(f"   saved  →  evaluation_report.txt")

    # ── Console summary ───────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  EVALUATION COMPLETE")
    print("=" * 65)
    print(f"\n  ┌─ XGBoost Classifier {'─'*38}┐")
    print(f"  │  Accuracy   {xm['accuracy']:.4f}   ROC-AUC  {xm['roc_auc']:.4f}         │")
    print(f"  │  Precision  {xm['precision']:.4f}   PR-AUC   {xm['pr_auc']:.4f}         │")
    print(f"  │  Recall     {xm['recall']:.4f}   F1-Score {xm['f1']:.4f}         │")
    print(f"  └{'─'*59}┘")
    print(f"\n  ┌─ Isolation Forest {'─'*40}┐")
    print(f"  │  Accuracy   {im['accuracy']:.4f}   ROC-AUC  {im['roc_auc']:.4f}         │")
    print(f"  │  Precision  {im['precision']:.4f}   PR-AUC   {im['pr_auc']:.4f}         │")
    print(f"  │  Recall     {im['recall']:.4f}   F1-Score {im['f1']:.4f}         │")
    print(f"  └{'─'*59}┘")
    print(f"\n  Artifacts saved to: {ARTIFACTS_DIR}")
    print("=" * 65)
    print("  DONE!")
    print("=" * 65)


if __name__ == "__main__":
    main()
