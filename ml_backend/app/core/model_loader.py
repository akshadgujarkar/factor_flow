"""
Singleton model loader — loads XGBoost, Isolation Forest, SHAP, and feature list
at startup and makes them available across the app.
"""

import json
import pickle
from pathlib import Path
from typing import Optional

import xgboost as xgb
import shap
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest

from app.core.config import settings


class _ModelState:
    """Internal singleton state container."""
    xgb_model: Optional[xgb.XGBClassifier]       = None
    iso_forest: Optional[IsolationForest]          = None
    scaler: Optional[StandardScaler]               = None
    shap_explainer: Optional[shap.TreeExplainer]   = None
    feature_columns: Optional[list]                = None
    metadata: Optional[dict]                       = None
    _loaded: bool                                  = False


class ModelLoader:
    """Static model registry used throughout the FastAPI app."""

    @staticmethod
    def load():
        md = settings.MODELS_DIR

        # XGBoost
        _ModelState.xgb_model = xgb.XGBClassifier()
        _ModelState.xgb_model.load_model(str(md / "xgb_model.json"))

        # Isolation Forest + Scaler
        with open(md / "iso_forest.pkl", "rb") as f:
            _ModelState.iso_forest = pickle.load(f)
        with open(md / "scaler.pkl", "rb") as f:
            _ModelState.scaler = pickle.load(f)

        # SHAP
        with open(md / "shap_explainer.pkl", "rb") as f:
            _ModelState.shap_explainer = pickle.load(f)

        # Feature columns
        with open(md / "feature_columns.json") as f:
            _ModelState.feature_columns = json.load(f)

        # Metadata
        with open(md / "model_metadata.json") as f:
            _ModelState.metadata = json.load(f)

        _ModelState._loaded = True

    @staticmethod
    def is_loaded() -> bool:
        return _ModelState._loaded

    @staticmethod
    def get_xgb():
        return _ModelState.xgb_model

    @staticmethod
    def get_iso():
        return _ModelState.iso_forest

    @staticmethod
    def get_scaler():
        return _ModelState.scaler

    @staticmethod
    def get_shap():
        return _ModelState.shap_explainer

    @staticmethod
    def get_features():
        return _ModelState.feature_columns

    @staticmethod
    def get_metadata():
        return _ModelState.metadata
