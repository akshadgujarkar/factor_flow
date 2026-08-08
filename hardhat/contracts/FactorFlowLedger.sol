// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title FactorFlowLedger
 * @dev Cryptographic audit ledger for recording trade fraud alerts, risk scores, 
 * SHAP proof hashes, and compliance officer triage actions on-chain.
 */
contract FactorFlowLedger {
    address public owner;

    enum Severity { Low, Medium, High, Critical }

    struct AlertRecord {
        string tradeId;
        string traderId;
        uint256 riskScore;
        Severity severity;
        string shapProofHash;
        uint256 timestamp;
        address recordedBy;
        bool resolved;
        string resolutionNote;
    }

    // Mapping from tradeId to AlertRecord
    mapping(string => AlertRecord) private alerts;
    // List of all recorded trade IDs
    string[] public alertTradeIds;
    // Mapping from traderId to array of tradeIds
    mapping(string => string[]) private traderAlerts;

    // Events
    event AlertRecorded(
        string indexed tradeId,
        string indexed traderId,
        uint256 riskScore,
        Severity severity,
        string shapProofHash,
        uint256 timestamp,
        address indexed recordedBy
    );

    event AlertResolved(
        string indexed tradeId,
        string resolutionNote,
        address indexed resolvedBy,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "FactorFlowLedger: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Record a high-risk trade alert on-chain.
     */
    function recordAlert(
        string calldata tradeId,
        string calldata traderId,
        uint256 riskScore,
        Severity severity,
        string calldata shapProofHash
    ) external {
        require(bytes(tradeId).length > 0, "FactorFlowLedger: tradeId cannot be empty");
        require(bytes(alerts[tradeId].tradeId).length == 0, "FactorFlowLedger: alert already recorded");
        require(riskScore <= 100, "FactorFlowLedger: risk score must be <= 100");

        AlertRecord memory record = AlertRecord({
            tradeId: tradeId,
            traderId: traderId,
            riskScore: riskScore,
            severity: severity,
            shapProofHash: shapProofHash,
            timestamp: block.timestamp,
            recordedBy: msg.sender,
            resolved: false,
            resolutionNote: ""
        });

        alerts[tradeId] = record;
        alertTradeIds.push(tradeId);
        traderAlerts[traderId].push(tradeId);

        emit AlertRecorded(
            tradeId,
            traderId,
            riskScore,
            severity,
            shapProofHash,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @dev Update compliance resolution status for a flagged alert.
     */
    function resolveAlert(string calldata tradeId, string calldata resolutionNote) external {
        require(bytes(alerts[tradeId].tradeId).length > 0, "FactorFlowLedger: alert does not exist");
        require(!alerts[tradeId].resolved, "FactorFlowLedger: alert is already resolved");

        alerts[tradeId].resolved = true;
        alerts[tradeId].resolutionNote = resolutionNote;

        emit AlertResolved(tradeId, resolutionNote, msg.sender, block.timestamp);
    }

    /**
     * @dev Get detailed alert record by tradeId.
     */
    function getAlert(string calldata tradeId) external view returns (AlertRecord memory) {
        require(bytes(alerts[tradeId].tradeId).length > 0, "FactorFlowLedger: alert does not exist");
        return alerts[tradeId];
    }

    /**
     * @dev Get total count of recorded alerts.
     */
    function getAlertCount() external view returns (uint256) {
        return alertTradeIds.length;
    }

    /**
     * @dev Get all alert IDs associated with a specific trader.
     */
    function getTraderAlerts(string calldata traderId) external view returns (string[] memory) {
        return traderAlerts[traderId];
    }
}
