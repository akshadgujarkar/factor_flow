const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

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

export interface BlockchainStatusResponse {
  enabled: boolean;
  connected: boolean;
  rpc_url: string | null;
  chain_id: number | null;
  contract_address: string | null;
  server_wallet: string | null;
  gas_balance_eth: number;
  total_alerts_on_chain: number;
}

export interface OnChainAlertResponse {
  trade_id: string;
  trader_id: string;
  risk_score: number;
  severity: string;
  shap_proof_hash: string;
  timestamp: number;
  recorded_by: string;
  resolved: boolean;
  resolution_note: string;
  transaction_hash?: string;
}

export interface ResolveAlertResponse {
  success: boolean;
  trade_id: string;
  transaction_hash: string;
  status: string;
  block_number: number;
  gas_used: number;
  detail?: string;
  reason?: string;
}

export interface RecordAlertPayload {
  trade_id: string;
  trader_id: string;
  risk_score: number;
  severity: string;
  shap_proof_hash?: string;
  shap_explanations?: Record<string, any>[];
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

  // --- Blockchain Backend Endpoints ---
  async getBlockchainStatus(): Promise<BlockchainStatusResponse> {
    const res = await fetch(`${BASE_URL}/blockchain/status`);
    if (!res.ok) throw new Error("Failed to fetch blockchain status");
    return res.json();
  },

  async getOnChainAlerts(): Promise<OnChainAlertResponse[]> {
    const res = await fetch(`${BASE_URL}/blockchain/alerts`);
    if (!res.ok) throw new Error("Failed to fetch on-chain alerts");
    const data = await res.json();
    return data.alerts || [];
  },

  async getOnChainAlert(tradeId: string): Promise<OnChainAlertResponse> {
    const res = await fetch(`${BASE_URL}/blockchain/alerts/${encodeURIComponent(tradeId)}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error("Alert not found on-chain");
      throw new Error("Failed to fetch on-chain alert details");
    }
    return res.json();
  },

  async resolveAlertOnChain(tradeId: string, resolutionNote: string = "Resolved by Compliance Officer"): Promise<ResolveAlertResponse> {
    const res = await fetch(`${BASE_URL}/blockchain/alerts/${encodeURIComponent(tradeId)}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution_note: resolutionNote }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || errData.reason || "Failed to resolve alert on-chain");
    }
    return res.json();
  },

  async recordAlertOnChain(payload: RecordAlertPayload): Promise<{ status: string; message: string; trade_id: string }> {
    const res = await fetch(`${BASE_URL}/blockchain/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to record alert on-chain");
    }
    return res.json();
  },
};
