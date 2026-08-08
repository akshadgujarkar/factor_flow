"""
Web3 Client & Server-side Transaction Signer with Safe Nonce Management.
"""

import logging
import threading
from typing import Optional, Dict, Any

from app.blockchain.config import blockchain_settings

logger = logging.getLogger("blockchain_client")


class NonceManager:
    """Thread-safe nonce manager to prevent race conditions during concurrent alert submissions."""

    def __init__(self):
        self._lock = threading.Lock()
        self._current_nonce: Optional[int] = None

    def get_and_increment(self, w3, account_address: str) -> int:
        """
        Atomically get the next usable nonce and increment the internal counter.
        Syncs against chain 'pending' state if our internal counter has fallen behind.
        This prevents nonce-too-low and replacement-transaction-underpriced errors under concurrency.
        """
        with self._lock:
            pending_nonce = w3.eth.get_transaction_count(account_address, "pending")
            if self._current_nonce is None or pending_nonce > self._current_nonce:
                self._current_nonce = pending_nonce
            nonce_to_use = self._current_nonce
            self._current_nonce += 1
            return nonce_to_use

    def reset(self):
        """Reset the nonce tracker — call this after a reverted transaction."""
        with self._lock:
            self._current_nonce = None


class BlockchainClient:
    """Manages Web3 connection, server account credentials, and transaction broadcasting."""

    def __init__(self):
        self.w3 = None
        self.account = None
        self.nonce_manager = NonceManager()
        self._initialized = False

    def initialize(self) -> bool:
        """Set up the Web3 connection and load the server-side signing account."""
        if not blockchain_settings.BLOCKCHAIN_ENABLED:
            logger.info("Blockchain integration is disabled (BLOCKCHAIN_ENABLED=False).")
            return False

        try:
            from web3 import Web3
            from eth_account import Account
        except ImportError:
            logger.error("web3 package is not installed. Run: pip install web3")
            return False

        rpc_url = blockchain_settings.BLOCKCHAIN_RPC_URL
        if not rpc_url:
            logger.error("BLOCKCHAIN_RPC_URL is not configured.")
            return False

        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            logger.warning(f"Could not connect to RPC provider at {rpc_url}. Retrying at request time.")
            return False

        private_key = blockchain_settings.BLOCKCHAIN_PRIVATE_KEY
        if private_key:
            if not private_key.startswith("0x"):
                private_key = "0x" + private_key
            try:
                self.account = Account.from_key(private_key)
                logger.info(f"Server-side blockchain wallet initialized: {self.account.address}")
            except Exception as e:
                logger.error(f"Failed to load server wallet from private key: {str(e)}")
                return False
        else:
            logger.warning("No BLOCKCHAIN_PRIVATE_KEY configured. Read-only RPC mode active.")

        self._initialized = True
        return True

    def is_connected(self) -> bool:
        if not self.w3:
            return False
        try:
            return self.w3.is_connected()
        except Exception:
            return False

    def get_wallet_address(self) -> Optional[str]:
        return self.account.address if self.account else None

    def get_gas_balance(self) -> float:
        """Return the server wallet's ETH balance in ether."""
        if not self.is_connected() or not self.account:
            return 0.0
        try:
            balance_wei = self.w3.eth.get_balance(self.account.address)
            return float(self.w3.from_wei(balance_wei, "ether"))
        except Exception:
            return 0.0

    def send_transaction(self, contract_func, gas_limit: Optional[int] = None) -> Dict[str, Any]:
        """
        Build, sign locally, and broadcast a smart contract transaction using the server-side wallet.
        MetaMask is completely bypassed — this runs entirely server-side.
        Returns dict with transaction_hash, status, block_number, gas_used.
        """
        if not self._initialized:
            if not self.initialize():
                raise RuntimeError("Blockchain client is not initialized or disabled.")

        if not self.account:
            raise ValueError("Server-side private key is not configured for signing transactions.")

        if not self.is_connected():
            raise ConnectionError("Lost connection to RPC provider.")

        chain_id = blockchain_settings.BLOCKCHAIN_CHAIN_ID or self.w3.eth.chain_id
        nonce = self.nonce_manager.get_and_increment(self.w3, self.account.address)

        tx_params: Dict[str, Any] = {
            "from": self.account.address,
            "nonce": nonce,
            "chainId": chain_id,
        }

        # Gas estimation with 20% buffer
        try:
            estimated_gas = contract_func.estimate_gas({"from": self.account.address})
            tx_params["gas"] = gas_limit or int(estimated_gas * 1.2)
        except Exception as e:
            logger.warning(f"Gas estimation failed, using fallback 300,000 gas: {str(e)}")
            tx_params["gas"] = gas_limit or 300_000

        # EIP-1559 fee market detection, fallback to legacy gasPrice
        try:
            latest_block = self.w3.eth.get_block("latest")
            if "baseFeePerGas" in latest_block:
                max_priority_fee = self.w3.eth.max_priority_fee
                base_fee = latest_block["baseFeePerGas"]
                tx_params["maxPriorityFeePerGas"] = max_priority_fee
                tx_params["maxFeePerGas"] = base_fee * 2 + max_priority_fee
            else:
                tx_params["gasPrice"] = self.w3.eth.gas_price
        except Exception:
            tx_params["gasPrice"] = self.w3.eth.gas_price

        # Build and sign the raw transaction entirely server-side — no MetaMask, no popup
        raw_tx = contract_func.build_transaction(tx_params)
        signed_tx = self.w3.eth.account.sign_transaction(raw_tx, private_key=self.account.key)

        # Broadcast the signed raw bytes to the RPC provider
        tx_hash_bytes = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_hash_str = self.w3.to_hex(tx_hash_bytes)

        logger.info(f"[Blockchain] Transaction broadcasted | hash={tx_hash_str} | nonce={nonce} | wallet={self.account.address}")

        # Wait for receipt up to BLOCKCHAIN_TX_TIMEOUT seconds
        timeout = blockchain_settings.BLOCKCHAIN_TX_TIMEOUT
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=timeout)

        status_ok = receipt.get("status") == 1
        if not status_ok:
            # On revert, reset nonce so the next tx re-syncs from chain state
            self.nonce_manager.reset()
            logger.error(f"[Blockchain] Transaction reverted | hash={tx_hash_str}")
        else:
            logger.info(
                f"[Blockchain] Transaction confirmed | hash={tx_hash_str} "
                f"| block={receipt.get('blockNumber')} | gas={receipt.get('gasUsed')}"
            )

        return {
            "transaction_hash": tx_hash_str,
            "status": "success" if status_ok else "reverted",
            "block_number": receipt.get("blockNumber"),
            "gas_used": receipt.get("gasUsed"),
        }


blockchain_client = BlockchainClient()
