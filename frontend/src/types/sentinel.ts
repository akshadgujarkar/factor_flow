/**
 * API-facing data contracts. These mirror exactly what the ML backend is
 * expected to return, so components can consume live responses unchanged.
 */

export type Severity = "Low" | "Medium" | "High" | "Critical";
export type AlertStatus = "Pending" | "Investigating" | "Closed" | "Confirmed Fraud" | "False Positive" | "Under Investigation" | "Escalated";
export type UserRole = "Investigator" | "Compliance Officer" | "Admin";

export type FraudType =
  | "Insider Trading"
  | "Market Manipulation"
  | "Pump and Dump"
  | "Wash Trading"
  | "Spoofing"
  | "Front Running";

export interface Trade {
  trade_id: string;
  trader_id: string;
  company: string;
  symbol: string;
  trade_type: "BUY" | "SELL";
  quantity: number;
  price: number;
  timestamp: string;
}

export interface RiskPrediction {
  fraud_probability: number;
  anomaly_score: number;
  risk_score: number;
  severity: Severity;
  flagged: boolean;
}

export interface Explainability {
  feature: string;
  impact: number;
}

export interface Alert {
  alert_id: string;
  trader_id: string;
  stock: string;
  company: string;
  risk_score: number;
  severity: Severity;
  status: AlertStatus;
  fraud_type: FraudType;
  fraud_probability: number;
  anomaly_score: number;
  created_at: string;
  assigned_to: string;
  case_id: string;
  reason: string;
  top_reasons: Explainability[];
  anchored?: boolean;
  tx_hash?: string;
}

export interface BlockchainRecord {
  tx_hash: string;
  case_id: string;
  trader_id: string;
  stock: string;
  fraud_type: string;
  confidence: number;
  timestamp: string;
  anchored: boolean;
  confirmed_by: string;
  confirmed_role: UserRole | "System";
  reason: string;
  block: number;
}

export interface ModelCard {
  id: string;
  name: FraudType;
  status: "Active" | "Training" | "Idle";
  confidence: number;
  detections: number;
  last_scan: string;
  description: string;
}

export interface DataSource {
  id: string;
  name: string;
  status: "Connected" | "Processing" | "Failed";
  fields: string[];
  throughput: string;
  latency: string;
  /** Real row count from the backing CSV file */
  record_count?: number;
  /** ISO-8601 UTC timestamp of last file modification */
  last_updated?: string;
}

/**
 * A leaderboard entry is an Alert enriched with a live rank and an optional
 * animation hint (_flash) that the UI clears after the transition completes.
 */
export interface LeaderboardEntry extends Alert {
  rank: number;
  trade_id?: string;
  _flash?: "new" | "moved" | "updated" | "removed";
}

export type LeaderboardEventType =
  | "SNAPSHOT"
  | "NEW_ENTRY"
  | "RANK_CHANGE"
  | "SCORE_UPDATE"
  | "REMOVED"
  | "HEARTBEAT";

export interface LeaderboardEvent {
  event: LeaderboardEventType;
  entry?: LeaderboardEntry;
  board?: LeaderboardEntry[];   // only present for SNAPSHOT
  rank?: number;
  prev_rank?: number;
}


export interface TimelineEvent {
  id: string;
  time: string;
  label: string;
  detail: string;
  kind: "trade" | "comm" | "market" | "system" | "ai";
}

export interface AuthUser {
  email: string;
  role: UserRole;
  name: string;
}
