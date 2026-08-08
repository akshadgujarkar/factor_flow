"""
Contract ABI definition for FactorFlowLedger smart contract.
"""

FACTORFLOW_LEDGER_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "string", "name": "tradeId", "type": "string"},
            {"indexed": True, "internalType": "string", "name": "traderId", "type": "string"},
            {"indexed": False, "internalType": "uint256", "name": "riskScore", "type": "uint256"},
            {"indexed": False, "internalType": "enum FactorFlowLedger.Severity", "name": "severity", "type": "uint8"},
            {"indexed": False, "internalType": "string", "name": "shapProofHash", "type": "string"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"indexed": True, "internalType": "address", "name": "recordedBy", "type": "address"}
        ],
        "name": "AlertRecorded",
        "type": "event"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "string", "name": "tradeId", "type": "string"},
            {"indexed": False, "internalType": "string", "name": "resolutionNote", "type": "string"},
            {"indexed": True, "internalType": "address", "name": "resolvedBy", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
        ],
        "name": "AlertResolved",
        "type": "event"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "alertTradeIds",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "string", "name": "tradeId", "type": "string"}],
        "name": "getAlert",
        "outputs": [
            {
                "components": [
                    {"internalType": "string", "name": "tradeId", "type": "string"},
                    {"internalType": "string", "name": "traderId", "type": "string"},
                    {"internalType": "uint256", "name": "riskScore", "type": "uint256"},
                    {"internalType": "enum FactorFlowLedger.Severity", "name": "severity", "type": "uint8"},
                    {"internalType": "string", "name": "shapProofHash", "type": "string"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                    {"internalType": "address", "name": "recordedBy", "type": "address"},
                    {"internalType": "bool", "name": "resolved", "type": "bool"},
                    {"internalType": "string", "name": "resolutionNote", "type": "string"}
                ],
                "internalType": "struct FactorFlowLedger.AlertRecord",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAlertCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "string", "name": "traderId", "type": "string"}],
        "name": "getTraderAlerts",
        "outputs": [{"internalType": "string[]", "name": "", "type": "string[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "tradeId", "type": "string"},
            {"internalType": "string", "name": "traderId", "type": "string"},
            {"internalType": "uint256", "name": "riskScore", "type": "uint256"},
            {"internalType": "enum FactorFlowLedger.Severity", "name": "severity", "type": "uint8"},
            {"internalType": "string", "name": "shapProofHash", "type": "string"}
        ],
        "name": "recordAlert",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "tradeId", "type": "string"},
            {"internalType": "string", "name": "resolutionNote", "type": "string"}
        ],
        "name": "resolveAlert",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]
