const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying FactorFlow Smart Contracts...");

  // 1. Deploy FactorFlowLedger
  const FactorFlowLedger = await hre.ethers.getContractFactory("FactorFlowLedger");
  const ledger = await FactorFlowLedger.deploy();
  await ledger.waitForDeployment();

  const ledgerAddress = await ledger.getAddress();
  console.log(`✅ FactorFlowLedger deployed to: ${ledgerAddress}`);

  // 2. Deploy sample Lock contract
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const unlockTime = currentTimestampInSeconds + 60; // unlock in 60s
  const lockedAmount = hre.ethers.parseEther("0.001");

  const Lock = await hre.ethers.getContractFactory("Lock");
  const lock = await Lock.deploy(unlockTime, { value: lockedAmount });
  await lock.waitForDeployment();

  const lockAddress = await lock.getAddress();
  console.log(`✅ Lock contract deployed to: ${lockAddress} (Unlocked at ${unlockTime})`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
