const { expect } = require("chai");
const hre = require("hardhat");

describe("FactorFlowLedger Contract", function () {
  let ledger;
  let owner;
  let officer;

  beforeEach(async function () {
    [owner, officer] = await hre.ethers.getSigners();
    const FactorFlowLedger = await hre.ethers.getContractFactory("FactorFlowLedger");
    ledger = await FactorFlowLedger.deploy();
    await ledger.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await ledger.owner()).to.equal(owner.address);
    });

    it("Should start with 0 alerts recorded", async function () {
      expect(await ledger.getAlertCount()).to.equal(0);
    });
  });

  describe("Alert Recording", function () {
    it("Should successfully record a trade alert", async function () {
      const tradeId = "TRD-88291";
      const traderId = "TRD-901";
      const riskScore = 92;
      const severity = 3; // Critical
      const shapProof = "0xa1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";

      await expect(
        ledger.connect(officer).recordAlert(tradeId, traderId, riskScore, severity, shapProof)
      )
        .to.emit(ledger, "AlertRecorded")
        .withArgs(tradeId, traderId, riskScore, severity, shapProof, (ts) => ts > 0, officer.address);

      expect(await ledger.getAlertCount()).to.equal(1);

      const alert = await ledger.getAlert(tradeId);
      expect(alert.tradeId).to.equal(tradeId);
      expect(alert.traderId).to.equal(traderId);
      expect(alert.riskScore).to.equal(riskScore);
      expect(alert.severity).to.equal(severity);
      expect(alert.shapProofHash).to.equal(shapProof);
      expect(alert.resolved).to.equal(false);
    });

    it("Should prevent recording duplicate alert IDs", async function () {
      const tradeId = "TRD-99001";
      await ledger.recordAlert(tradeId, "TRD-100", 85, 2, "0x1234");

      await expect(
        ledger.recordAlert(tradeId, "TRD-100", 85, 2, "0x1234")
      ).to.be.revertedWith("FactorFlowLedger: alert already recorded");
    });
  });

  describe("Alert Resolution", function () {
    it("Should resolve an alert and record resolution notes", async function () {
      const tradeId = "TRD-77100";
      await ledger.recordAlert(tradeId, "TRD-202", 78, 2, "0xproof");

      await expect(
        ledger.connect(officer).resolveAlert(tradeId, "Verified insider relationship via HR logs")
      )
        .to.emit(ledger, "AlertResolved")
        .withArgs(tradeId, "Verified insider relationship via HR logs", officer.address, (ts) => ts > 0);

      const alert = await ledger.getAlert(tradeId);
      expect(alert.resolved).to.equal(true);
      expect(alert.resolutionNote).to.equal("Verified insider relationship via HR logs");
    });
  });
});
