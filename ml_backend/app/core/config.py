from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent


class Settings(BaseSettings):
    APP_NAME: str = "Insider Trading Detector"
    VERSION: str = "1.0.0"

    MODELS_DIR: Path = BASE_DIR / "models"
    DATA_DIR: Path   = BASE_DIR / "data"

    # Risk score thresholds
    SEVERITY_MEDIUM: float   = 40.0
    SEVERITY_HIGH: float     = 70.0
    SEVERITY_CRITICAL: float = 85.0

    # Hybrid risk weights
    WEIGHT_FRAUD: float   = 0.45
    WEIGHT_ANOMALY: float = 0.30
    WEIGHT_RULE: float    = 0.15
    WEIGHT_NETWORK: float = 0.10

    # XGBoost classification threshold
    XGB_THRESHOLD: float = 0.40

    # WebSocket live feed delay (seconds per trade)
    WS_INTERVAL: float = 0.8

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
