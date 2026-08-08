# 🔗 FactorFlow — Hardhat Smart Contract Audit Ledger

This directory contains the Hardhat smart contract development workspace for **FactorFlow**'s cryptographic blockchain audit trail.

## 📁 Directory Structure

```
hardhat/
├── contracts/
│   ├── FactorFlowLedger.sol   # Audit log contract for trade alert proofs & compliance notes
│   └── Lock.sol               # Standard sample Solidity contract
├── scripts/
│   └── deploy.js              # Contract deployment script
├── test/
│   └── FactorFlowLedger.js    # Unit tests using Chai & Ethers.js
├── hardhat.config.js          # Hardhat configuration file
└── package.json               # Dependencies & NPM scripts
```

## 🚀 Available Commands

### 1. Compile Smart Contracts
```bash
npm run compile
```

### 2. Run Smart Contract Tests
```bash
npm run test
```

### 3. Start Local Hardhat Ethereum Node
```bash
npm run node
```

### 4. Deploy Contracts locally
```bash
npm run deploy:local
```
