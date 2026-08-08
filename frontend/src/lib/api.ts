const BASE_URL = "http://localhost:8000/api";

export interface MLStats {
  model_version: string;
  trained_on: string;
  dataset: {
    n_train: number;
    n_test: number;
    anomaly_rate: number;
    scale_pos_weight: number;
  };
  xgboost: {
    roc_auc: number;
    pr_auc: number;
    f1: number;
    precision: number;
    recall: number;
    threshold: number;
  };
  isolation_forest: {
    roc_auc: number;
    pr_auc: number;
    f1: number;
  };
  risk_weights: any;
  top_shap_features: string[];
  all_features: string[];
}

export interface TradeInput {
  trade_id: string;
  trader_id: string;
  ticker: string;
  action: string;
  quantity: number;
  price: number;
}

export interface PredictResponse {
  trade_id: string;
  fraud_probability: number;
  anomaly_score: number;
  risk_score: number;
  severity: string;
  flagged: boolean;
  shap_values?: { feature: string; value: number }[];
}

export interface BatchPredictResponse {
  count: number;
  flagged: number;
  results: PredictResponse[];
}

export const api = {
  async getStats(): Promise<MLStats> {
    const res = await fetch(`${BASE_URL}/stats`);
    if (!res.ok) throw new Error("Failed to fetch ML stats");
    return res.json();
  },

  async predictTrade(trade: TradeInput): Promise<PredictResponse> {
    const res = await fetch(`${BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trade),
    });
    if (!res.ok) throw new Error("Failed to predict trade");
    return res.json();
  },

  async predictBatch(trades: TradeInput[]): Promise<BatchPredictResponse> {
    const res = await fetch(`${BASE_URL}/predict/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trades }),
    });
    if (!res.ok) throw new Error("Failed to batch predict trades");
    return res.json();
  },
};
