"""
Comprehensive unit tests for app/blockchain module.

Covers:
- Disabled mode (BLOCKCHAIN_ENABLED=false)
- RPC connection validation
- Input validation
- SHAP proof hash generation (deterministic)
- Nonce manager thread-safety and atomicity
- record_alert duplicate idempotency
- resolve_alert error handling
- Service graceful degradation when contract unconfigured
"""

import threading
import unittest
from unittest.mock import MagicMock, patch, PropertyMock

from app.blockchain.config import BlockchainSettings
from app.blockchain.client import NonceManager, BlockchainClient
from app.blockchain.service import FactorFlowBlockchainService, SEVERITY_MAP


class TestBlockchainDisabledMode(unittest.TestCase):
    """All calls must return safely when BLOCKCHAIN_ENABLED=False."""

    def setUp(self):
        self.service = FactorFlowBlockchainService()

    def _patched_disabled_service(self):
        settings = BlockchainSettings(BLOCKCHAIN_ENABLED=False)
        return settings

    def test_record_alert_disabled(self):
        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = False
            result = self.service.record_alert("TRD-001", "TRD-007", 95.0, "Critical")
            self.assertFalse(result["success"])
            self.assertIn("disabled", result["reason"].lower())

    def test_resolve_alert_disabled(self):
        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = False
            result = self.service.resolve_alert("TRD-001", "Test resolution")
            self.assertFalse(result["success"])
            self.assertIn("disabled", result["reason"].lower())

    def test_get_alert_disabled_returns_none(self):
        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = False
            result = self.service.get_alert("TRD-001")
            self.assertIsNone(result)

    def test_get_alert_count_disabled_returns_zero(self):
        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = False
            result = self.service.get_alert_count()
            self.assertEqual(result, 0)

    def test_get_trader_alerts_disabled_returns_empty(self):
        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = False
            result = self.service.get_trader_alerts("TRD-007")
            self.assertEqual(result, [])


class TestSHAPProofHashGeneration(unittest.TestCase):
    """Verify deterministic proof hash generation."""

    def setUp(self):
        self.service = FactorFlowBlockchainService()

    def test_hash_starts_with_0x(self):
        h = self.service._generate_shap_proof_hash("TRD-001", 95.0)
        self.assertTrue(h.startswith("0x"))

    def test_hash_is_deterministic(self):
        explanations = [{"feature": "volume_ratio", "shap_value": 3.5, "feature_value": 8.2}]
        h1 = self.service._generate_shap_proof_hash("TRD-001", 95.0, explanations)
        h2 = self.service._generate_shap_proof_hash("TRD-001", 95.0, explanations)
        self.assertEqual(h1, h2)

    def test_different_trade_ids_give_different_hashes(self):
        h1 = self.service._generate_shap_proof_hash("TRD-001", 95.0)
        h2 = self.service._generate_shap_proof_hash("TRD-002", 95.0)
        self.assertNotEqual(h1, h2)

    def test_hash_is_64_hex_chars_after_prefix(self):
        h = self.service._generate_shap_proof_hash("TRD-001", 88.0)
        self.assertEqual(len(h), 66)  # "0x" + 64 hex chars


class TestSeverityMapping(unittest.TestCase):
    """Verify Solidity enum mapping."""

    def test_all_severities_present(self):
        self.assertEqual(SEVERITY_MAP["Low"], 0)
        self.assertEqual(SEVERITY_MAP["Medium"], 1)
        self.assertEqual(SEVERITY_MAP["High"], 2)
        self.assertEqual(SEVERITY_MAP["Critical"], 3)

    def test_risk_score_clamping(self):
        # risk_uint = int(min(max(risk_score, 0), 100))
        self.assertEqual(int(min(max(110.0, 0), 100)), 100)
        self.assertEqual(int(min(max(-5.0, 0), 100)), 0)
        self.assertEqual(int(min(max(85.5, 0), 100)), 85)


class TestNonceManager(unittest.TestCase):
    """Thread-safety and atomicity of nonce allocation."""

    def test_sequential_increments(self):
        manager = NonceManager()
        mock_w3 = MagicMock()
        mock_w3.eth.get_transaction_count.return_value = 10

        n1 = manager.get_and_increment(mock_w3, "0xABC")
        n2 = manager.get_and_increment(mock_w3, "0xABC")
        n3 = manager.get_and_increment(mock_w3, "0xABC")

        self.assertEqual(n1, 10)
        self.assertEqual(n2, 11)
        self.assertEqual(n3, 12)

    def test_syncs_when_chain_is_ahead(self):
        """If chain nonce jumps ahead (e.g., external tx), manager resyncs."""
        manager = NonceManager()
        mock_w3 = MagicMock()

        # First call: chain at 5
        mock_w3.eth.get_transaction_count.return_value = 5
        n1 = manager.get_and_increment(mock_w3, "0xABC")
        self.assertEqual(n1, 5)

        # Second call: chain jumped to 10 (external tx sent)
        mock_w3.eth.get_transaction_count.return_value = 10
        n2 = manager.get_and_increment(mock_w3, "0xABC")
        self.assertEqual(n2, 10)

    def test_reset_clears_nonce(self):
        manager = NonceManager()
        mock_w3 = MagicMock()
        mock_w3.eth.get_transaction_count.return_value = 7

        manager.get_and_increment(mock_w3, "0xABC")  # now at 8
        manager.reset()

        # After reset, next call resyncs from chain
        mock_w3.eth.get_transaction_count.return_value = 7
        n = manager.get_and_increment(mock_w3, "0xABC")
        self.assertEqual(n, 7)

    def test_concurrent_thread_safety(self):
        """Multiple threads cannot get the same nonce."""
        manager = NonceManager()
        mock_w3 = MagicMock()
        mock_w3.eth.get_transaction_count.return_value = 0

        collected_nonces = []
        lock = threading.Lock()

        def grab_nonce():
            n = manager.get_and_increment(mock_w3, "0xABC")
            with lock:
                collected_nonces.append(n)

        threads = [threading.Thread(target=grab_nonce) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All nonces must be unique
        self.assertEqual(len(collected_nonces), 20)
        self.assertEqual(len(set(collected_nonces)), 20, "Duplicate nonces detected in concurrent test!")


class TestBlockchainClientInitialization(unittest.TestCase):
    """BlockchainClient initialization under different env conditions."""

    def test_disabled_init_returns_false(self):
        client = BlockchainClient()
        with patch("app.blockchain.client.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = False
            result = client.initialize()
            self.assertFalse(result)

    def test_missing_rpc_url_returns_false(self):
        client = BlockchainClient()
        with patch("app.blockchain.client.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = True
            mock_cfg.BLOCKCHAIN_RPC_URL = None
            result = client.initialize()
            self.assertFalse(result)

    def test_is_connected_false_when_not_initialized(self):
        client = BlockchainClient()
        self.assertFalse(client.is_connected())

    def test_get_wallet_address_returns_none_without_account(self):
        client = BlockchainClient()
        self.assertIsNone(client.get_wallet_address())

    def test_get_gas_balance_returns_zero_when_not_connected(self):
        client = BlockchainClient()
        self.assertEqual(client.get_gas_balance(), 0.0)


class TestServiceWithMockedClient(unittest.TestCase):
    """service.py using a fully mocked blockchain_client and contract."""

    def _make_enabled_service(self, contract_mock):
        service = FactorFlowBlockchainService()
        service._contract_instance = contract_mock
        return service

    def test_record_alert_duplicate_idempotency(self):
        """If getAlert returns existing record, record_alert skips transaction."""
        contract = MagicMock()
        # Simulate existing alert returned by getAlert
        contract.functions.getAlert.return_value.call.return_value = (
            "TRD-001", "TRD-007", 92, 3, "0xhash", 1234567890, "0xAddr", False, ""
        )

        service = self._make_enabled_service(contract)

        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = True
            mock_cfg.FACTORFLOW_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"
            with patch("app.blockchain.service.blockchain_client") as mock_client:
                mock_client.is_connected.return_value = True
                mock_client.w3.to_checksum_address.return_value = "0x1234567890123456789012345678901234567890"
                mock_client.w3.eth.contract.return_value = contract

                result = service.record_alert("TRD-001", "TRD-007", 92.0, "Critical")
                self.assertTrue(result.get("already_recorded"))

    def test_record_alert_invalid_empty_trade_id(self):
        """Empty trade_id must return failure without hitting the chain."""
        contract = MagicMock()
        service = self._make_enabled_service(contract)

        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = True
            mock_cfg.FACTORFLOW_CONTRACT_ADDRESS = "0x1234"

            result = service.record_alert("", "TRD-007", 92.0, "Critical")
            self.assertFalse(result["success"])
            self.assertIn("trade_id", result["reason"].lower())


class TestRiskThresholdAndIdempotency(unittest.TestCase):
    """Verify exact risk score threshold rules (risk_score > 85)."""

    def setUp(self):
        self.service = FactorFlowBlockchainService()

    def test_risk_score_84_not_submitted(self):
        """riskScore = 84 -> Must NOT be recorded on blockchain."""
        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = True
            mock_cfg.BLOCKCHAIN_RISK_THRESHOLD = 85.0
            result = self.service.record_alert("TRD-84", "TRD-007", 84.0, "High")
            self.assertFalse(result["success"])
            self.assertEqual(result.get("status"), "Not Required")

    def test_risk_score_85_not_submitted(self):
        """riskScore = 85 -> Must NOT be recorded on blockchain (strictly > 85)."""
        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = True
            mock_cfg.BLOCKCHAIN_RISK_THRESHOLD = 85.0
            result = self.service.record_alert("TRD-85", "TRD-007", 85.0, "Critical")
            self.assertFalse(result["success"])
            self.assertEqual(result.get("status"), "Not Required")

    def test_risk_score_86_submitted(self):
        """riskScore = 86 -> Must be submitted to blockchain."""
        contract = MagicMock()
        contract.functions.getAlert.side_effect = Exception("Not found")
        self.service._contract_instance = contract

        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = True
            mock_cfg.BLOCKCHAIN_RISK_THRESHOLD = 85.0
            mock_cfg.FACTORFLOW_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"
            with patch("app.blockchain.service.blockchain_client") as mock_client:
                mock_client.is_connected.return_value = True
                mock_client.send_transaction.return_value = {
                    "status": "success",
                    "transaction_hash": "0x123456789abcdef",
                    "block_number": 100,
                }

                result = self.service.record_alert("TRD-86", "TRD-007", 86.0, "Critical")
                self.assertTrue(result["success"])
                self.assertEqual(result.get("status"), "Confirmed")
                self.assertEqual(result.get("transaction_hash"), "0x123456789abcdef")

    def test_risk_score_100_submitted(self):
        """riskScore = 100 -> Must be submitted to blockchain."""
        contract = MagicMock()
        contract.functions.getAlert.side_effect = Exception("Not found")
        self.service._contract_instance = contract

        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = True
            mock_cfg.BLOCKCHAIN_RISK_THRESHOLD = 85.0
            mock_cfg.FACTORFLOW_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"
            with patch("app.blockchain.service.blockchain_client") as mock_client:
                mock_client.is_connected.return_value = True
                mock_client.send_transaction.return_value = {
                    "status": "success",
                    "transaction_hash": "0x100hash",
                    "block_number": 101,
                }

                result = self.service.record_alert("TRD-100", "TRD-007", 100.0, "Critical")
                self.assertTrue(result["success"])
                self.assertEqual(result.get("status"), "Confirmed")

    def test_rpc_failure_graceful_handling(self):
        """If RPC is unavailable, record_alert logs failure safely without throwing."""
        contract = MagicMock()
        contract.functions.getAlert.side_effect = Exception("Not found")
        self.service._contract_instance = contract

        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = True
            mock_cfg.BLOCKCHAIN_RISK_THRESHOLD = 85.0
            mock_cfg.FACTORFLOW_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"
            with patch("app.blockchain.service.blockchain_client") as mock_client:
                mock_client.is_connected.return_value = True
                mock_client.send_transaction.side_effect = Exception("RPC Connection Refused")

                result = self.service.record_alert("TRD-RPC-FAIL", "TRD-007", 92.0, "Critical")
                self.assertFalse(result["success"])
                self.assertEqual(result.get("status"), "Failed")
                self.assertIn("failed", result.get("error").lower())

    def test_duplicate_pending_submission_prevention(self):
        """Concurrent or duplicate submission while pending is prevented."""
        self.service._pending_trades.add("TRD-PENDING")

        with patch("app.blockchain.service.blockchain_settings") as mock_cfg:
            mock_cfg.BLOCKCHAIN_ENABLED = True
            mock_cfg.BLOCKCHAIN_RISK_THRESHOLD = 85.0

            result = self.service.record_alert("TRD-PENDING", "TRD-007", 90.0, "Critical")
            self.assertTrue(result.get("already_pending"))
            self.assertEqual(result.get("status"), "Pending")


if __name__ == "__main__":
    unittest.main()

