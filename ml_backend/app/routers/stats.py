from fastapi import APIRouter
from app.core.model_loader import ModelLoader

router = APIRouter()


@router.get("/stats", summary="Model and dataset statistics")
def get_stats():
    """Return model performance metrics and feature importance."""
    meta = ModelLoader.get_metadata()
    if not meta:
        return {"status": "models not loaded"}

    return {
        "model_version"     : meta.get("version"),
        "trained_on"        : meta.get("trained_on"),
        "dataset"           : {
            "n_train"          : meta.get("n_train"),
            "n_test"           : meta.get("n_test"),
            "anomaly_rate"     : round(meta.get("anomaly_rate_train", 0) * 100, 2),
            "scale_pos_weight" : meta.get("scale_pos_weight"),
        },
        "xgboost"           : {
            "roc_auc"   : meta.get("xgb_roc_auc"),
            "pr_auc"    : meta.get("xgb_pr_auc"),
            "f1"        : meta.get("xgb_f1"),
            "precision" : meta.get("xgb_precision"),
            "recall"    : meta.get("xgb_recall"),
            "threshold" : meta.get("xgb_threshold"),
        },
        "isolation_forest"  : {
            "roc_auc" : meta.get("iso_roc_auc"),
            "pr_auc"  : meta.get("iso_pr_auc"),
            "f1"      : meta.get("iso_f1"),
        },
        "risk_weights"      : meta.get("risk_weights"),
        "top_shap_features" : meta.get("top_shap_features"),
        "all_features"      : meta.get("feature_columns"),
    }
