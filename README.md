# ⚡ FactorFlow — Real-Time ML Market Surveillance & Fraud Detection Platform

> **AI-Powered Financial Market Surveillance, Insider Trading Detection, Explainable AI (SHAP), and Cryptographic Audit Ledger.**

![FactorFlow Architecture](https://img.shields.io/badge/Architecture-Hybrid%20ML%20%2B%20FastAPI%20%2B%20React%2019-blue?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![XGBoost](https://img.shields.io/badge/ML%20Model-XGBoost%20%2B%20Isolation%20Forest-FF6F00?style=for-the-badge&logo=xgboost&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TanStack%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind%20v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)

---

## 📌 Executive Overview

**FactorFlow** (SentinelAI) is an enterprise-grade, real-time Machine Learning market surveillance platform designed to detect **insider trading**, **market manipulation**, and **anomalous trading behavior** across global financial markets. 

By combining **supervised gradient boosting (XGBoost)**, **unsupervised anomaly detection (Isolation Forest)**, **explainable AI (SHAP)**, and an **immutable blockchain audit trail**, FactorFlow converts millions of high-frequency trade logs into prioritized, interpretable, and regulatory-compliant risk insights.

---

## 🎯 Problems We Are Solving

Financial surveillance in traditional markets and digital asset exchanges faces severe limitations. FactorFlow is engineered to directly solve these critical industry challenges:

### 1. 🕵️ Undetected Pre-Event Front-Running & Insider Trading
* **Problem:** Bad actors execute trades right before price-sensitive corporate announcements (earnings reports, M&A acquisitions, FDA approvals). Traditional systems miss subtle accumulative trades spread across multiple accounts or instruments (e.g., out-of-the-money options).
* **FactorFlow Solution:** FactorFlow computes real-time pre-event window proximity flags (`is_pre_event_window`), volume ratios vs 30-day baselines, and cross-instrument unusual flags to flag front-running hours before public disclosures.

### 2. ⚡ High False-Positive Rate in Legacy Rule-Based Systems
* **Problem:** Traditional compliance software uses rigid static thresholds (e.g., "flag trades > $500,000"). This results in thousands of false positives daily, exhausting compliance teams.
* **FactorFlow Solution:** Implements a dynamic **Hybrid Risk Score** combining statistical peer-group deviation, isolation forest anomaly detection, and ML fraud probability, lowering false positives while increasing true detection rates.

### 3. 🔍 The "Black Box" AI Explainability Deficit
* **Problem:** Regulators (SEC, FINRA, ESMA, CFTC) require transparent evidence. Standard deep learning or black-box ML models cannot explain *why* a specific trade was flagged, making legal enforcement difficult.
* **FactorFlow Solution:** Integrated **TreeSHAP Explainability** engine generates per-trade feature attributions, showing exact positive and negative contribution scores for every prediction.

### 4. 🕸️ Coordinated Fraud & Communication Blind Spots
* **Problem:** Fraudulent trading often involves networks of colluding insiders, broker-dealers, and external traders communicating privately.
* **FactorFlow Solution:** Integrates communication network risk scoring (`network_risk`) and interactive network graph analysis to uncover hidden relationships between traders and corporate insiders.

### 5. 📜 Tamperable Case Records & Compliance Disputes
* **Problem:** Internal compliance logs and audit trails can be altered or challenged in court.
* **FactorFlow Solution:** Employs a **Cryptographic Blockchain Audit Ledger** that logs high-severity alerts and investigation state transitions on an immutable tamper-evident chain.

### 6. ⏱️ Slow Batch-Oriented Processing
* **Problem:** Legacy systems process trades overnight via batch ETL scripts, allowing fraudulent actors to withdraw capital or exit positions before detection.
* **FactorFlow Solution:** High-throughput asynchronous **FastAPI WebSockets** and batch vector inference deliver sub-millisecond real-time streaming surveillance.

---

## 🔄 End-to-End System Workflow

Below is the complete architectural workflow of FactorFlow, from market data ingestion to real-time compliance actioning:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               1. DATA INGESTION                                 │
│    • Real-Time Trade Stream      • Corporate Events (M&A, Earnings, FDA)        │
│    • Communication Metadata      • Trader Profiles & Historical Baselines       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     2. REAL-TIME FEATURE ENGINEERING ENGINE                     │
│    • Volume Ratio & 30-Day Z-Score     • Pre-Event Proximity Window (48h)        │
│    • Peer Group Deviation Metrics       • Cross-Instrument Options & Futures     │
│    • PnL % & Win-Streak Anomalies      • Communication Network Risk Index         │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           3. HYBRID ML SURVEILLANCE                             │
│   ┌────────────────────────┐  ┌───────────────────────┐  ┌────────────────────┐   │
│   │    XGBoost Classifier  │  │   Isolation Forest    │  │ Communication Net  │   │
│   │ (Supervised Model: 45%)│  │ (Unsupervised: 30%)   │  │  & Rules (25%)     │   │
│   └───────────┬────────────┘  └───────────┬───────────┘  └─────────┬──────────┘   │
│               └─────────────────────┐     │     ┌──────────────────┘              │
│                                     ▼     ▼     ▼                                 │
│                         COMPOSITE HYBRID RISK SCORE (0 - 100)                     │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     4. EXPLAINABLE AI & AUDIT GENERATION                        │
│    • TreeSHAP Calculation (Top 10 feature impact values for every trade)          │
│    • Severity Classification: Low (0-39) | Medium (40-69) | High / Critical (70+) │
│    • Cryptographic Hash Generation & Blockchain Ledger Audit Entry                │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    5. EXECUTIVE SURVEILLANCE FRONTEND DASHBOARD                 │
│    • Real-Time Alert Triage Queue       • Interactive D3 Risk Beeswarm Plot     │
│    • SHAP Feature Attribution Panels    • Trader Network Graph & Entity Profile │
│    • Blockchain Ledger Verifier         • One-Click SEC / Regulatory Export     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

### **Machine Learning & Backend (Python)**
* **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Asynchronous REST API + WebSockets)
* **ASGI Server:** [Uvicorn](https://www.uvicorn.org/)
* **Supervised Learning:** [XGBoost](https://xgboost.readthedocs.io/) (Gradient Boosted Trees for fraud probability)
* **Unsupervised Learning:** [Scikit-Learn Isolation Forest](https://scikit-learn.org/) (Novelty & outlier detection)
* **Explainable AI:** [SHAP (SHapley Additive exPlanations)](https://shap.readthedocs.io/)
* **Data Processing:** Pandas, NumPy, Pydantic v2
* **Synthetic Data Generator:** Python Faker & Custom Financial Market Simulator

### **Frontend Command Center (TypeScript & React)**
* **Core Framework:** [React 19](https://react.dev/) + [TanStack Start](https://tanstack.com/start/latest) / [TanStack Router](https://tanstack.com/router/latest)
* **Build Tooling:** [Vite](https://vitejs.dev/)
* **Styling & UI:** [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, Lucide React Icons
* **Data Visualization:** [D3.js](https://d3js.org/) (`d3-force`, `d3-scale`, `d3-array`, `d3-shape`) for custom SVG beeswarms and network graphs, Recharts
* **State & Query:** TanStack Query (React Query), Zustand / Custom React Hooks

---

## 📐 Hybrid Risk Scoring Engine & Performance Metrics

### **Composite Risk Formula**
FactorFlow calculates a normalized risk score from $0$ to $100$ using weighted evidence across four distinct surveillance pillars:

$$\text{Risk Score} = 100 \times \Big( 0.45 \cdot P_{\text{fraud}} + 0.30 \cdot S_{\text{anomaly}} + 0.15 \cdot S_{\text{rule}} + 0.10 \cdot R_{\text{network}} \Big)$$

Where:
* $P_{\text{fraud}}$ = XGBoost predicted fraud probability.
* $S_{\text{anomaly}}$ = Isolation Forest normalized anomaly score.
* $S_{\text{rule}}$ = Rule engine score (pre-event window, after-hours, instrument flags).
* $R_{\text{network}}$ = Trader-insider communication network proximity index.

### **Severity Classification**
| Risk Score Range | Severity Level | System Action |
| :--- | :--- | :--- |
| **85 – 100** | 🚨 **Critical** | Immediate trading freeze, high-priority alert, blockchain log entry |
| **70 – 84** | ⚠️ **High** | Escalated to Compliance Officer queue, automated SHAP dossier |
| **40 – 69** | ⚡ **Medium** | Flagged for automated behavioral monitoring |
| **0 – 39** | ✅ **Low** | Normal market activity baseline |

### **Model Performance Metrics**
* **XGBoost Classifier:** ROC-AUC: `1.00` | Precision: `1.00` | Recall: `1.00` | F1-Score: `1.00`
* **Isolation Forest:** ROC-AUC: `0.983` | PR-AUC: `0.808`

---

## 📁 Repository Structure

```
factor_flow/
├── ml_backend/                       # Python ML & FastAPI Service
│   ├── app/                          # Application source code
│   │   ├── core/                     # Configuration & Model Loader singletons
│   │   ├── routers/                  # API endpoints (trades, stats, websocket)
│   │   ├── schemas/                  # Pydantic data validation models
│   │   └── services/                 # Prediction pipeline & SHAP service
│   ├── data/                         # Generated synthetic datasets (120k trades)
│   ├── models/                       # Trained ML artifacts (.json, .pkl)
│   ├── generate_dataset.py           # Synthetic financial data generator script
│   ├── train_model.py                # Model training script
│   ├── evaluate_model.py             # Model evaluation & benchmark suite
│   ├── requirements.txt              # Python dependencies
│   └── README.md                     # Backend specific documentation
│
└── frontend/                         # React 19 + TanStack Front-End Dashboard
    ├── src/
    │   ├── components/               # UI components & Sentinel surveillance widgets
    │   │   ├── sentinel/             # Beeswarm charts, network graphs, tables
    │   │   └── ui/                   # Radix UI styled primitives
    │   ├── routes/                   # TanStack Router pages
    │   │   ├── index.tsx             # Landing Page
    │   │   ├── dashboard.tsx         # Command Center
    │   │   ├── alerts.tsx            # Alert Queue & Triage
    │   │   ├── explainability.tsx    # SHAP Inspector Workspace
    │   │   ├── analytics.tsx         # Market & Trader Analytics
    │   │   ├── blockchain.tsx        # Cryptographic Audit Ledger
    │   │   ├── engine.tsx            # ML Risk Model Configuration
    │   │   ├── investigations.tsx    # Compliance Case Management
    │   │   ├── monitoring.tsx        # WebSocket Live Feed Monitor
    │   │   └── traders.tsx           # Trader Profiles & Peer Analysis
    │   └── styles.css                # Global CSS & Tailwind configuration
    ├── package.json                  # Frontend dependencies
    └── vite.config.ts                # Vite build configuration
```

---

## 🚀 Quick Start & Installation

Follow these steps to run FactorFlow locally on your machine.

### **Prerequisites**
* **Python 3.10+**
* **Node.js 18+** or **Bun**

---

### **Step 1: Set Up & Launch the ML Backend**

1. Navigate to the `ml_backend` directory:
   ```bash
   cd ml_backend
   ```

2. Create and activate a virtual environment:
   * **Windows (PowerShell):**
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   * **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. *(Optional)* Regenerate dataset and train models:
   ```bash
   python generate_dataset.py
   python train_model.py
   ```

5. Start the FastAPI backend server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   * FastAPI Server runs at: `http://localhost:8000`
   * Interactive API Documentation (Swagger UI): `http://localhost:8000/docs`

---

### **Step 2: Set Up & Launch the Frontend**

1. Open a new terminal tab and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   * Application runs at: `http://localhost:3000` (or `http://localhost:5173`)

---

## 🔌 API Reference & Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Service health & root metadata |
| `GET` | `/health` | Model status check |
| `POST` | `/api/predict` | Single trade evaluation + SHAP explanations |
| `POST` | `/api/predict/batch` | High-speed batch prediction (up to 1,000 trades) |
| `GET` | `/api/stats` | Model evaluation statistics & feature importance rankings |
| `WS` | `/ws/live-feed` | Real-time WebSocket streaming feed of processed market trades |

---

## 🌟 Key Machine Learning Features (SHAP Ranked)

1. `volume_ratio` — Ratio of trade volume compared to trader's 30-day moving average.
2. `peer_group_deviation` — Statistical divergence from peer trader baseline behavior.
3. `is_pre_event_window` — Trade executed within 48 hours of a major corporate announcement.
4. `volume_zscore_30d` — Z-score measuring volume deviation.
5. `pnl_pct` — Abnormal profit/loss percentage achieved on transaction.
6. `price_impact_proxy` — Estimated price impact attributed to the transaction.
7. `consecutive_profitable_trades` — Unusually long streak of winning trades prior to major events.
8. `unusual_instrument_flag` — First-time or unexpected derivative trading (Options/Futures).
9. `network_risk` — Proximity score based on communications with corporate insiders.
10. `after_hours_flag` — Trades executed during pre-market or post-market illiquid sessions.

---

## 🤝 Contributing & License

Contributions are welcome! Please feel free to open issues or submit pull requests to improve FactorFlow's detection algorithms, UI visualizations, or integration adapters.

Distributed under the **MIT License**.
