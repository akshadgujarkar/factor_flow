"""
High-level service for recording and querying FactorFlow alerts on the blockchain ledger.
"""

import hashlib
import logging
from typing import Dict, Any, List, Optional, Set

from app.blockchain.config import blockchain_settings
from app.blockchain.client import blockchain_client
from app.blockchain.contract import FACTORFLOW_LEDGER_ABI

logger = logging.getLogger("blockchain_service")


SEVERITY_MAP = {
    "Low": 0,
    "Medium": 1,
    "High": 2,
    "Critical": 3
}


class FactorFlowBlockchainService:
    def __init__(self):
        self._contract_instance = None
        self._pending_trades: Set[str] = set()
        self._tx_hashes: Dict[str, str] = {}

    def _get_contract(self):
        if not blockchain_settings.BLOCKCHAIN_ENABLED:
            return None

        if not blockchain_client.is_connected():
            blockchain_client.initialize()

        if not blockchain_client.is_connected():
            return None

        contract_address = blockchain_settings.FACTORFLOW_CONTRACT_ADDRESS
        if not contract_address or contract_address == "0x0000000000000000000000000000000000000000":
            logger.warning("FACTORFLOW_CONTRACT_ADDRESS is not set.")
            return None

        if self._contract_instance is None:
            w3 = blockchain_client.w3
            address = w3.to_checksum_address(contract_address)
            self._contract_instance = w3.eth.contract(address=address, abi=FACTORFLOW_LEDGER_ABI)

        return self._contract_instance

    def _generate_shap_proof_hash(self, trade_id: str, risk_score: float, shap_explanations: Optional[List[Dict[str, Any]]] = None) -> str:
        """Computes a deterministic SHA-256 cryptographic hash of the SHAP explanations proof."""
        payload = f"{trade_id}:{risk_score}:{str(shap_explanations or [])}"
        return "0x" + hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def record_alert(
        self,
        trade_id: str,
        trader_id: str,
        risk_score: float,
        severity: str,
        shap_explanations: Optional[List[Dict[str, Any]]] = None,
        shap_proof_hash: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Record a trade alert on-chain automatically.
        Enforces risk_score > BLOCKCHAIN_RISK_THRESHOLD (85).
        Idempotent: checks if alert was already recorded or is currently pending.
        """
        if not blockchain_settings.BLOCKCHAIN_ENABLED:
            return {"success": False, "reason": "Blockchain is disabled", "status": "Not Required"}

        if not trade_id:
            return {"success": False, "reason": "trade_id cannot be empty", "status": "Failed"}

        threshold = blockchain_settings.BLOCKCHAIN_RISK_THRESHOLD
        if risk_score <= threshold:
            logger.info(
                f"Risk score evaluated: trade_id={trade_id}, risk_score={risk_score}, "
                f"threshold={threshold}, blockchain_required=False"
            )
            return {
                "success": False,
                "reason": f"Risk score ({risk_score}) <= threshold ({threshold})",
                "status": "Not Required",
                "trade_id": trade_id,
            }

        logger.info(
            f"Risk score evaluated: trade_id={trade_id}, risk_score={risk_score}, "
            f"threshold={threshold}, blockchain_required=True"
        )

        if trade_id in self._pending_trades:
            logger.info(f"Transaction already pending for trade {trade_id}. Skipping duplicate submission.")
            return {
                "success": True,
                "trade_id": trade_id,
                "status": "Pending",
                "already_pending": True,
            }

        contract = self._get_contract()
        if not contract:
            logger.error(f"Blockchain service unavailable or contract unconfigured for trade {trade_id}")
            return {
                "success": False,
                "trade_id": trade_id,
                "status": "Failed",
                "reason": "Blockchain service unavailable or contract unconfigured",
            }

        trader_id = trader_id or "UNKNOWN_TRADER"
        sev_uint = SEVERITY_MAP.get(severity, 1)
        risk_uint = int(min(max(risk_score, 0), 100))
        proof_hash = shap_proof_hash or self._generate_shap_proof_hash(trade_id, risk_score, shap_explanations)

        # Idempotency check: verify if alert already exists on contract
        try:
            existing = contract.functions.getAlert(trade_id).call()
            if existing and existing[0] == trade_id:
                logger.info(f"Alert {trade_id} is already recorded on-chain. Skipping duplicate tx.")
                return {
                    "success": True,
                    "trade_id": trade_id,
                    "status": "Confirmed",
                    "already_recorded": True,
                    "shap_proof_hash": proof_hash,
                }
        except Exception:
            pass  # Reverts when alert does not exist (expected)

        self._pending_trades.add(trade_id)
        try:
            func = contract.functions.recordAlert(
                trade_id,
                trader_id,
                risk_uint,
                sev_uint,
                proof_hash
            )

            logger.info(f"Submitting high-risk trade to blockchain: trade_id={trade_id}, risk_score={risk_score}")
            result = blockchain_client.send_transaction(func)
            tx_hash = result.get("transaction_hash")

            if tx_hash:
                self._tx_hashes[trade_id] = tx_hash

            if result.get("status") == "success":
                logger.info(f"Blockchain transaction confirmed: trade_id={trade_id}, tx_hash={tx_hash}")
                return {
                    "success": True,
                    "trade_id": trade_id,
                    "status": "Confirmed",
                    "transaction_hash": tx_hash,
                    "block_number": result.get("block_number"),
                    "shap_proof_hash": proof_hash,
                }
            else:
                logger.error(f"Blockchain transaction failed or reverted: trade_id={trade_id}")
                return {
                    "success": False,
                    "trade_id": trade_id,
                    "status": "Reverted" if result.get("status") == "reverted" else "Failed",
                    "transaction_hash": tx_hash,
                    "error": "Blockchain transaction failed",
                }
        except Exception as e:
            logger.error(f"Failed to record alert {trade_id} on-chain: {str(e)}")
            return {
                "success": False,
                "trade_id": trade_id,
                "status": "Failed",
                "error": "Blockchain transaction failed",
                "detail": str(e)
            }
        finally:
            self._pending_trades.discard(trade_id)

    def resolve_alert(self, trade_id: str, resolution_note: str) -> Dict[str, Any]:
        """Resolve a flagged trade alert on-chain."""
        if not blockchain_settings.BLOCKCHAIN_ENABLED:
            return {"success": False, "reason": "Blockchain is disabled"}

        contract = self._get_contract()
        if not contract:
            return {"success": False, "reason": "Blockchain service unavailable or contract unconfigured"}

        func = contract.functions.resolveAlert(trade_id, resolution_note or "Resolved by Compliance Officer")
        try:
            result = blockchain_client.send_transaction(func)
            tx_hash = result.get("transaction_hash")
            if tx_hash:
                self._tx_hashes[f"resolve_{trade_id}"] = tx_hash
            return {
                "success": result["status"] == "success",
                "trade_id": trade_id,
                "transaction_hash": tx_hash,
                "block_number": result.get("block_number"),
            }
        except Exception as e:
            logger.error(f"Failed to resolve alert {trade_id} on-chain: {str(e)}")
            return {
                "success": False,
                "trade_id": trade_id,
                "error": "Blockchain resolution failed",
                "detail": str(e)
            }

    def _sync_tx_hashes_from_events(self):
        """Query contract AlertRecorded events to populate transaction hashes directly from Hardhat RPC logs."""
        contract = self._get_contract()
        if not contract or not blockchain_client.w3:
            return
        try:
            w3 = blockchain_client.w3
            events = contract.events.AlertRecorded.get_logs(from_block=0)
            for evt in events:
                t_id = evt.args.get("tradeId")
                tx_hash_bytes = getattr(evt, "transactionHash", None)
                if t_id and tx_hash_bytes:
                    tx_hash_str = w3.to_hex(tx_hash_bytes)
                    self._tx_hashes[t_id] = tx_hash_str
        except Exception as e:
            logger.warning(f"Could not sync transaction hashes from AlertRecorded events: {str(e)}")

    def get_alert(self, trade_id: str) -> Optional[Dict[str, Any]]:
        """Read-only call to get on-chain alert details."""
        contract = self._get_contract()
        if not contract:
            return None

        try:
            data = contract.functions.getAlert(trade_id).call()
            if not self._tx_hashes.get(trade_id):
                self._sync_tx_hashes_from_events()

            severity_names = ["Low", "Medium", "High", "Critical"]
            return {
                "trade_id": data[0],
                "trader_id": data[1],
                "risk_score": data[2],
                "severity": severity_names[data[3]] if data[3] < 4 else "Unknown",
                "shap_proof_hash": data[4],
                "timestamp": data[5],
                "recorded_by": data[6],
                "resolved": data[7],
                "resolution_note": data[8],
                "transaction_hash": self._tx_hashes.get(trade_id),
            }
        except Exception as e:
            logger.warning(f"On-chain alert {trade_id} not found: {str(e)}")
            return None

    def get_alert_count(self) -> int:
        """Read-only call to get total alert count on-chain."""
        contract = self._get_contract()
        if not contract:
            return 0
        try:
            return contract.functions.getAlertCount().call()
        except Exception:
            return 0

    def get_trader_alerts(self, trader_id: str) -> List[str]:
        """Read-only call to get all trade IDs for a trader."""
        contract = self._get_contract()
        if not contract:
            return []
        try:
            return contract.functions.getTraderAlerts(trader_id).call()
        except Exception:
            return []

    def get_all_alerts(self) -> List[Dict[str, Any]]:
        """Get all recorded on-chain alerts with their stored transaction hashes."""
        contract = self._get_contract()
        if not contract:
            return []

        self._sync_tx_hashes_from_events()

        try:
            count = contract.functions.getAlertCount().call()
            alerts = []
            severity_names = ["Low", "Medium", "High", "Critical"]
            for i in range(count):
                try:
                    trade_id = contract.functions.alertTradeIds(i).call()
                    data = contract.functions.getAlert(trade_id).call()
                    alerts.append({
                        "trade_id": data[0],
                        "trader_id": data[1],
                        "risk_score": data[2],
                        "severity": severity_names[data[3]] if data[3] < 4 else "Unknown",
                        "shap_proof_hash": data[4],
                        "timestamp": data[5],
                        "recorded_by": data[6],
                        "resolved": data[7],
                        "resolution_note": data[8],
                        "transaction_hash": self._tx_hashes.get(data[0]),
                        "status": "Resolved" if data[7] else "Confirmed",
                    })
                except Exception as err:
                    logger.warning(f"Error fetching alert index {i}: {err}")
            return alerts
        except Exception as e:
            logger.error(f"Failed to fetch all on-chain alerts: {str(e)}")
            return []


blockchain_service = FactorFlowBlockchainService()
