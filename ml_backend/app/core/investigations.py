import asyncio
import uuid
import datetime
from typing import Dict, List, Any, Optional

class InvestigationManager:
    """In-memory state manager for investigation cases."""
    
    # Store all cases: case_id -> case_dict
    cases: Dict[str, Dict[str, Any]] = {}
    
    # Map trader_id -> case_id for the *active* case for that trader
    active_cases_by_trader: Dict[str, str] = {}
    
    _lock: asyncio.Lock = asyncio.Lock()

    @classmethod
    async def ingest(cls, scored_trade: Dict[str, Any]) -> None:
        """
        Process a scored trade. If it meets the criteria, create or update a case.
        Criteria: risk_score >= 75 OR severity in ('High', 'Critical') OR is_flagged == True
        """
        risk_score = float(scored_trade.get("risk_score", 0))
        severity = scored_trade.get("severity", "Low")
        is_flagged = scored_trade.get("is_flagged", False)

        if not (risk_score >= 75 or severity in ("High", "Critical") or is_flagged):
            return

        trader_id = scored_trade.get("trader_id", "UNKNOWN")
        
        async with cls._lock:
            # Check if this trader already has an active case
            if trader_id in cls.active_cases_by_trader:
                case_id = cls.active_cases_by_trader[trader_id]
                case = cls.cases[case_id]
                
                # Update the case with the highest severity/risk score
                if risk_score > case["risk_score"]:
                    case["risk_score"] = risk_score
                    case["fraud_probability"] = scored_trade.get("fraud_probability", case["fraud_probability"])
                    case["anomaly_score"] = scored_trade.get("anomaly_score", case["anomaly_score"])
                    case["severity"] = severity
                    case["trade_id"] = scored_trade.get("trade_id", case["trade_id"])
                    
                    # Update SHAP if new one is riskier
                    shaps = scored_trade.get("shap_explanations", [])
                    if shaps:
                        case["shap_explanations"] = shaps
            else:
                # Create a new case
                case_id = f"INV-{datetime.datetime.utcnow().year}-{str(uuid.uuid4())[:8].upper()}"
                
                fraud_prob = float(scored_trade.get("fraud_probability", 0))
                fraud_type = "Insider Trading" if fraud_prob > 0.8 else "Market Manipulation"
                ticker = scored_trade.get("ticker", scored_trade.get("symbol", "UNK"))
                
                case = {
                    "case_id": case_id,
                    "trade_id": scored_trade.get("trade_id", f"TRD-{uuid.uuid4().hex[:8]}"),
                    "trader_id": trader_id,
                    "stock": ticker,
                    "company": scored_trade.get("company", ticker),
                    "status": "Under Investigation",
                    "severity": severity,
                    "risk_score": risk_score,
                    "fraud_probability": fraud_prob,
                    "anomaly_score": float(scored_trade.get("anomaly_score", 0)),
                    "fraud_type": fraud_type,
                    "created_at": datetime.datetime.utcnow().isoformat() + "Z",
                    "closed_at": None,
                    "assigned_to": "Unassigned",
                    "reason": f"ML detected {fraud_type} pattern with {fraud_prob:.1%} confidence. Network risk elevated.",
                    "shap_explanations": scored_trade.get("shap_explanations", []),
                    "network_risk": float(scored_trade.get("network_risk", 0.0)),
                    "anchored": False,
                    "tx_hash": None,
                    "resolution_note": None
                }
                
                cls.cases[case_id] = case
                cls.active_cases_by_trader[trader_id] = case_id

    @classmethod
    def get_all(cls) -> List[Dict[str, Any]]:
        return list(cls.cases.values())

    @classmethod
    def get_case(cls, case_id: str) -> Optional[Dict[str, Any]]:
        return cls.cases.get(case_id)

    @classmethod
    async def update_status(cls, case_id: str, new_status: str, note: Optional[str] = None) -> Optional[Dict[str, Any]]:
        async with cls._lock:
            case = cls.cases.get(case_id)
            if not case:
                return None
                
            case["status"] = new_status
            if new_status in ["Confirmed Fraud", "False Positive", "Closed"]:
                case["closed_at"] = datetime.datetime.utcnow().isoformat() + "Z"
                if note:
                    case["resolution_note"] = note
                
                # Remove from active cases mapping so new trades open a new case
                trader_id = case["trader_id"]
                if trader_id in cls.active_cases_by_trader and cls.active_cases_by_trader[trader_id] == case_id:
                    del cls.active_cases_by_trader[trader_id]
                    
            return case

    @classmethod
    async def set_blockchain_hash(cls, case_id: str, tx_hash: str) -> Optional[Dict[str, Any]]:
        async with cls._lock:
            case = cls.cases.get(case_id)
            if not case:
                return None
            case["anchored"] = True
            case["tx_hash"] = tx_hash
            return case
