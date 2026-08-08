# 🕵️ Insider Trading & Fraudulent Behaviour Detector — ML Backend

Real-time ML surveillance system detecting insider trading and market manipulation.

## Project Structure

```
ml_backend/
├── data/                        # Generated datasets
│   ├── traders.csv              # 500 traders with behavioral baselines
│   ├── companies.csv            # 60 companies with market data
│   ├── corporate_events.csv     # 300 corporate events
│   ├── trades.csv               # 120,000 trades (7% anomalous)
│   ├── communications.csv       # 40,000 communication records
│   └── demo_trades.csv          # 2,500 stratified demo trades
│
├── models/                      # Saved ML artifacts (after training)
│   ├── xgb_model.json
│   ├── iso_forest.pkl
│   ├── scaler.pkl
│   ├── shap_explainer.pkl
│   ├── feature_columns.json
│   └── model_metadata.json
│
├── app/                         # FastAPI application
│   ├── main.py                  # App entrypoint
│   ├── core/
│   │   ├── config.py            # Settings & constants
│   │   └── model_loader.py      # Singleton model registry
│   ├── routers/
│   │   ├── trades.py            # POST /api/predict, /api/predict/batch
│   │   ├── stats.py             # GET /api/stats
│   │   └── websocket.py         # WS /ws/live-feed
│   ├── services/
│   │   └── predictor.py         # XGBoost + IsoForest + Hybrid risk
│   └── schemas/
│       └── trade.py             # Pydantic models
│
├── generate_dataset.py          # Step 1: Generate synthetic data
├── train_model.py               # Step 2: Train ML models
├── check_env.py                 # Pre-flight environment check
└── requirements.txt
```

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Generate dataset (already done)
```bash
python generate_dataset.py
```

### 3. Train models (~2-4 minutes)
```bash
python train_model.py
```

### 4. Start API server
```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Open API docs
```
http://localhost:8000/docs
```

## Core ML Pipeline

```
Trade → Feature Engineering → XGBoost + Isolation Forest
         → Hybrid Risk Score → SHAP Explanations → Alert
```

**Risk Score Formula:**
```
Risk = 100 × (0.45 × fraud_prob + 0.30 × anomaly_score
             + 0.15 × rule_score + 0.10 × network_risk)
```

**Severity Thresholds:**
| Score | Severity |
|-------|----------|
| 0–39  | Low      |
| 40–69 | Medium   |
| 70–84 | High     |
| 85–100| Critical |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/`      | Health check |
| `GET`  | `/health`| Model status |
| `POST` | `/api/predict` | Single trade prediction + SHAP |
| `POST` | `/api/predict/batch` | Batch predictions (up to 1000) |
| `GET`  | `/api/stats` | Model metrics & feature importance |
| `WS`   | `/ws/live-feed` | Real-time trade stream |

## Top ML Features (by SHAP importance)

1. `volume_ratio` — Current vs 30-day average volume
2. `volume_zscore_30d` — Statistical volume outlier score
3. `is_pre_event_window` — Within 48h of corporate event
4. `peer_group_deviation` — Deviation from peer trader group
5. `price_impact_proxy` — Price movement attribution
6. `hours_to_next_event` — Proximity to upcoming event
7. `after_hours_flag` — Pre/post market activity
8. `network_risk` — Communication network risk score
9. `unusual_instrument_flag` — Options/Futures vs normal
10. `pnl_pct` — Abnormal profit/loss percentage
