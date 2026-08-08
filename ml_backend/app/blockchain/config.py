from pydantic_settings import BaseSettings
from typing import Optional

class BlockchainSettings(BaseSettings):
    BLOCKCHAIN_ENABLED: bool = False
    BLOCKCHAIN_RPC_URL: str = "http://127.0.0.1:8545"
    BLOCKCHAIN_PRIVATE_KEY: Optional[str] = None
    FACTORFLOW_CONTRACT_ADDRESS: Optional[str] = None
    BLOCKCHAIN_CHAIN_ID: int = 31337
    BLOCKCHAIN_TX_TIMEOUT: int = 60
    BLOCKCHAIN_CONFIRMATIONS: int = 1

    class Config:
        env_file = ".env"
        extra = "ignore"

blockchain_settings = BlockchainSettings()
