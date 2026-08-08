const { expect } = require("chai");
const hre = require("hardhat");

describe("FactorFlowLedger Contract", function () {
  let ledger;
  let owner;
  let unauthorizedUser;

  beforeEach(async function () {
    [owner, unauthorizedUser] = await hre.ethers.getSigners();
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
    it("Should allow owner to successfully record a trade alert", async function () {
      const tradeId = "TRD-88291";
      const traderId = "TRD-901";
      const riskScore = 92;
      const severity = 3; // Critical
      const shapProof = "0xa1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";

      await expect(
        ledger.connect(owner).recordAlert(tradeId, traderId, riskScore, severity, shapProof)
      )
        .to.emit(ledger, "AlertRecorded")
        .withArgs(tradeId, traderId, riskScore, severity, shapProof, (ts) => ts > 0, owner.address);

      expect(await ledger.getAlertCount()).to.equal(1);

      const alert = await ledger.getAlert(tradeId);
      expect(alert.tradeId).to.equal(tradeId);
      expect(alert.traderId).to.equal(traderId);
      expect(alert.riskScore).to.equal(riskScore);
      expect(alert.severity).to.equal(severity);
      expect(alert.shapProofHash).to.equal(shapProof);
      expect(alert.resolved).to.equal(false);
    });

    it("Should revert if unauthorized non-owner attempts to record alert", async function () {
      await expect(
        ledger.connect(unauthorizedUser).recordAlert("TRD-999", "TRD-001", 90, 3, "0xproof")
      ).to.be.revertedWith("FactorFlowLedger: caller is not the owner");
    });

    it("Should prevent recording duplicate alert IDs", async function () {
      const tradeId = "TRD-99001";
      await ledger.connect(owner).recordAlert(tradeId, "TRD-100", 85, 2, "0x1234");

      await expect(
        ledger.connect(owner).recordAlert(tradeId, "TRD-100", 85, 2, "0x1234")
      ).to.be.revertedWith("FactorFlowLedger: alert already recorded");
    });
  });

  describe("Alert Resolution", function () {
    it("Should allow owner to resolve an alert", async function () {
      const tradeId = "TRD-77100";
      await ledger.connect(owner).recordAlert(tradeId, "TRD-202", 78, 2, "0xproof");

      await expect(
        ledger.connect(owner).resolveAlert(tradeId, "Verified insider relationship via HR logs")
      )
        .to.emit(ledger, "AlertResolved")
        .withArgs(tradeId, "Verified insider relationship via HR logs", owner.address, (ts) => ts > 0);

      const alert = await ledger.getAlert(tradeId);
      expect(alert.resolved).to.equal(true);
      expect(alert.resolutionNote).to.equal("Verified insider relationship via HR logs");
    });

    it("Should revert if unauthorized non-owner attempts to resolve alert", async function () {
      const tradeId = "TRD-77101";
      await ledger.connect(owner).recordAlert(tradeId, "TRD-202", 78, 2, "0xproof");

      await expect(
        ledger.connect(unauthorizedUser).resolveAlert(tradeId, "Unauthorized resolution attempt")
      ).to.be.revertedWith("FactorFlowLedger: caller is not the owner");
    });
  });
});
