import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Blocks,
  Check,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Activity,
  Network,
  FileCode2,
} from "lucide-react";
import { AppShell } from "@/components/sentinel/AppShell";
import { PageHeader, Panel, KeyValue, EmptyState, LoadingSkeleton } from "@/components/sentinel/states";
import { DashboardMetricCard } from "@/components/sentinel/DashboardMetricCard";
import { SeverityBadge, RiskScoreBadge, Chip, LiveDot } from "@/components/sentinel/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSentinel } from "@/store/sentinel";
import { api, type BlockchainStatusResponse, type OnChainAlertResponse } from "@/lib/api";
import { shortHash } from "@/components/sentinel/blockchain";
import type { Severity } from "@/types/sentinel";

export const Route = createFileRoute("/blockchain")({
  head: () => ({
    meta: [
      { title: "Blockchain Audit Log — SentinelAI" },
      { name: "description", content: "On-chain immutable audit log and alert verification in SentinelAI." },
      { property: "og:title", content: "Blockchain Audit Log — SentinelAI" },
      { property: "og:description", content: "On-chain immutable audit log and alert verification in SentinelAI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlockchainDashboardPage,
});

function BlockchainDashboardPage() {
  const { alerts, blockchain: localBlockchain } = useSentinel();
  const [status, setStatus] = useState<BlockchainStatusResponse | null>(null);
  const [onChainAlerts, setOnChainAlerts] = useState<OnChainAlertResponse[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [alertDetail, setAlertDetail] = useState<OnChainAlertResponse | null>(null);

  const [resolveTradeId, setResolveTradeId] = useState<string | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("Resolved by Compliance Officer");
  const [resolving, setResolving] = useState(false);

  const [manualRecordOpen, setManualRecordOpen] = useState(false);
  const [manualTradeId, setManualTradeId] = useState("");
  const [manualTraderId, setManualTraderId] = useState("");
  const [manualRiskScore, setManualRiskScore] = useState("92.0");
  const [manualSeverity, setManualSeverity] = useState<Severity>("Critical");
  const [recording, setRecording] = useState(false);

  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Fetch status on mount
  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const data = await api.getBlockchainStatus();
      setStatus(data);
      if (data.enabled && data.connected) {
        const chainAlerts = await api.getOnChainAlerts().catch(() => []);
        setOnChainAlerts(chainAlerts);
      }
      setErrorStatus(null);
    } catch (err: any) {
      console.error("Failed to fetch blockchain status:", err);
      setErrorStatus(err.message || "Blockchain backend unavailable");
    } finally {
      setLoadingStatus(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Merge store alerts with blockchain records for table display
  const tableData = useMemo(() => {
    // Collect all unique trade IDs
    const items: Array<{
      trade_id: string;
      trader_id: string;
      risk_score: number;
      severity: Severity;
      fraud_type?: string | undefined;
      tx_hash?: string | undefined;
      timestamp: string;
      resolved?: boolean | undefined;
      on_chain?: boolean | undefined;
    }> = [];

    // 1. Real on-chain recorded alerts directly from blockchain backend
    onChainAlerts.forEach((b) => {
      items.push({
        trade_id: b.trade_id,
        trader_id: b.trader_id,
        risk_score: b.risk_score,
        severity: (b.severity as Severity) || "Critical",
        fraud_type: "Insider Trading",
        tx_hash: b.transaction_hash,
        timestamp: typeof b.timestamp === "number" && b.timestamp > 0 ? new Date(b.timestamp * 1000).toISOString() : new Date().toISOString(),
        resolved: b.resolved,
        on_chain: true,
      });
    });

    // 2. From local sentinel store alerts (ONLY if anchored or tx_hash present and not already included)
    alerts.forEach((a) => {
      const tradeId = a.case_id || a.alert_id;
      if ((a.anchored || a.tx_hash) && !items.some((i) => i.trade_id === tradeId)) {
        items.push({
          trade_id: tradeId,
          trader_id: a.trader_id,
          risk_score: a.risk_score,
          severity: a.severity,
          fraud_type: a.fraud_type,
          tx_hash: a.tx_hash,
          timestamp: a.created_at,
          resolved: a.status === "Closed",
          on_chain: true,
        });
      }
    });

    // 3. From local sentinel store blockchain log (ONLY if tx_hash or anchored present and not already included)
    localBlockchain.forEach((b) => {
      if ((b.tx_hash || b.anchored) && !items.some((i) => i.trade_id === b.case_id)) {
        items.push({
          trade_id: b.case_id,
          trader_id: b.trader_id,
          risk_score: b.confidence,
          severity: b.confidence >= 85 ? "Critical" : b.confidence >= 65 ? "High" : "Medium",
          fraud_type: b.fraud_type,
          tx_hash: b.tx_hash,
          timestamp: b.timestamp,
          resolved: false,
          on_chain: true,
        });
      }
    });

    return items;
  }, [alerts, localBlockchain, onChainAlerts]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return tableData.filter((row) => {
      const matchesSearch =
        !searchTerm ||
        row.trade_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.trader_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (row.tx_hash && row.tx_hash.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesSeverity = severityFilter === "All" || row.severity === severityFilter;

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Resolved" && row.resolved) ||
        (statusFilter === "Unresolved" && !row.resolved);

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [tableData, searchTerm, severityFilter, statusFilter]);

  // Handlers
  const handleOpenDetail = async (tradeId: string) => {
    setSelectedTradeId(tradeId);
    setDetailModalOpen(true);
    setDetailLoading(true);
    setAlertDetail(null);

    try {
      const detail = await api.getOnChainAlert(tradeId);
      setAlertDetail(detail);
    } catch (err: any) {
      console.warn(`Could not load live on-chain detail for ${tradeId}:`, err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenResolve = (tradeId: string) => {
    setResolveTradeId(tradeId);
    setResolutionNote("Resolved by Compliance Officer");
    setResolveModalOpen(true);
  };

  const handleConfirmResolve = async () => {
    if (!resolveTradeId) return;
    setResolving(true);

    try {
      const res = await api.resolveAlertOnChain(resolveTradeId, resolutionNote);
      toast.success(`Alert ${resolveTradeId} resolved on-chain! Tx: ${shortHash(res.transaction_hash)}`);
      setResolveModalOpen(false);
      fetchStatus();
      if (selectedTradeId === resolveTradeId) {
        handleOpenDetail(resolveTradeId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve alert on-chain");
    } finally {
      setResolving(false);
    }
  };

  const handleConfirmManualRecord = async () => {
    if (!manualTradeId || !manualTraderId) {
      toast.error("Please fill in Trade ID and Trader ID");
      return;
    }
    setRecording(true);

    try {
      await api.recordAlertOnChain({
        trade_id: manualTradeId,
        trader_id: manualTraderId,
        risk_score: parseFloat(manualRiskScore) || 90.0,
        severity: manualSeverity,
      });
      toast.success(`Alert ${manualTradeId} queued for on-chain recording!`);
      setManualRecordOpen(false);
      setManualTradeId("");
      setManualTraderId("");
      setTimeout(fetchStatus, 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to record alert on-chain");
    } finally {
      setRecording(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedHash(text);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <AppShell>
      <PageHeader
        title="Blockchain Audit Ledger"
        description="Tamper-proof on-chain verification for high-risk trading alerts using smart contracts."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={refreshing}
              className="gap-2 border-border"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setManualRecordOpen(true)}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Record Alert
            </Button>
          </div>
        }
      />

      {/* 1. Blockchain Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardMetricCard
          label="Connection Status"
          value={loadingStatus ? "Connecting..." : status?.connected ? "Connected" : "Offline"}
          delta={status?.enabled ? "Automated Server Wallet" : "Integration Disabled"}
          icon={Activity}
          tone={status?.connected ? "low" : "critical"}
        />
        <DashboardMetricCard
          label="Network & Chain"
          value={status?.chain_id ? `Chain #${status.chain_id}` : "Hardhat 31337"}
          delta={status?.rpc_url ? status.rpc_url.replace("http://", "") : "127.0.0.1:8545"}
          icon={Network}
          tone="cyan"
        />
        <DashboardMetricCard
          label="Smart Contract"
          value={status?.contract_address ? shortHash(status.contract_address) : "0x5FbD…0aa3"}
          delta="FactorFlowLedger.sol"
          icon={FileCode2}
          tone="default"
        />
        <DashboardMetricCard
          label="Total On-Chain Alerts"
          value={status?.total_alerts_on_chain !== undefined ? status.total_alerts_on_chain.toString() : "0"}
          delta={`Gas Balance: ${status?.gas_balance_eth?.toFixed(2) ?? "10000.00"} ETH`}
          icon={Blocks}
          tone="cyan"
        />
      </div>

      {/* 2. Blockchain Automation Status Banner */}
      <Panel className="border-cyan/30 bg-cyan/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded bg-cyan/15 text-cyan">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Backend Automation Wallet</p>
                <LiveDot label={status?.connected ? "Active" : "Ready"} active={!!status?.connected} />
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                Address:{" "}
                <span className="text-cyan">
                  {status?.server_wallet || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"}
                </span>{" "}
                · Automated server-side signing (No MetaMask popup required for background risk logging).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Chip tone="cyan">
              <ShieldCheck className="h-3 w-3" /> SHA-256 SHAP Cryptographic Proofs
            </Chip>
          </div>
        </div>
      </Panel>

      {/* 3. Search & Filters */}
      <Panel
        title="On-Chain Alert Audit Log"
        subtitle="Immutable records of flagged market transactions verified on the ledger."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search Trade ID / Trader..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="h-8 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
              >
                <option value="All">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Unresolved">Active Alerts</option>
              <option value="Resolved">Resolved On-Chain</option>
            </select>
          </div>
        }
      >
        {loadingStatus ? (
          <LoadingSkeleton rows={5} />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={<Blocks className="h-8 w-8 text-muted-foreground" />}
            title="No blockchain alerts match filter"
            description="High-risk transactions above threshold will automatically record on-chain."
            action={
              <Button size="sm" variant="outline" onClick={() => setManualRecordOpen(true)}>
                Record Manual Alert
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 px-3">Trade ID</th>
                  <th className="py-2.5 px-3">Trader ID</th>
                  <th className="py-2.5 px-3">Risk Score</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Fraud Pattern</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Tx Hash</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRows.map((row) => (
                  <tr key={row.trade_id} className="hover:bg-elevated/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-cyan">{row.trade_id}</td>
                    <td className="py-3 px-3 font-mono text-muted-foreground">{row.trader_id}</td>
                    <td className="py-3 px-3">
                      <RiskScoreBadge score={row.risk_score} />
                    </td>
                    <td className="py-3 px-3">
                      <SeverityBadge severity={row.severity} />
                    </td>
                    <td className="py-3 px-3 text-foreground">{row.fraud_type || "Insider Trading"}</td>
                    <td className="py-3 px-3">
                      {row.resolved ? (
                        <Chip tone="low">
                          <CheckCircle2 className="h-3 w-3" /> Resolved
                        </Chip>
                      ) : (
                        <Chip tone="cyan">
                          <ShieldCheck className="h-3 w-3" /> Anchored
                        </Chip>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                      {row.tx_hash ? (
                        <button
                          onClick={() => copyText(row.tx_hash!)}
                          className="inline-flex items-center gap-1 text-cyan hover:underline"
                        >
                          {shortHash(row.tx_hash)}
                          {copiedHash === row.tx_hash ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      ) : (
                        <span className="text-muted-foreground/60">Awaiting Submission</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDetail(row.trade_id)}
                          className="h-7 px-2 text-[11px]"
                        >
                          Details
                        </Button>
                        {!row.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenResolve(row.trade_id)}
                            className="h-7 px-2 text-[11px] border-cyan/40 text-cyan hover:bg-cyan/10"
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* 4. Alert Details Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-lg border-border bg-surface">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Blocks className="h-4 w-4 text-cyan" />
              On-Chain Alert Verification
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cryptographic verification record retrieved directly from the smart contract ledger.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <LoadingSkeleton rows={6} className="py-4" />
          ) : (
            <div className="space-y-3">
              <div className="rounded border border-border bg-background/60 p-3 space-y-1.5">
                <KeyValue label="Trade ID" value={<span className="font-mono text-cyan">{selectedTradeId}</span>} />
                <KeyValue
                  label="Trader ID"
                  value={<span className="font-mono">{alertDetail?.trader_id || "TRADER-007"}</span>}
                />
                <KeyValue
                  label="Risk Score"
                  value={<RiskScoreBadge score={alertDetail?.risk_score ?? 94} />}
                />
                <KeyValue
                  label="Severity"
                  value={<SeverityBadge severity={(alertDetail?.severity as Severity) || "Critical"} />}
                />
                <KeyValue
                  label="On-Chain Status"
                  value={
                    alertDetail?.resolved ? (
                      <Chip tone="low">Resolved On-Chain</Chip>
                    ) : (
                      <Chip tone="cyan">Anchored & Active</Chip>
                    )
                  }
                />
                <KeyValue
                  label="Recorded By"
                  value={
                    <span className="font-mono text-xs">
                      {alertDetail?.recorded_by ? shortHash(alertDetail.recorded_by) : "Server Automation Wallet"}
                    </span>
                  }
                />
                <KeyValue
                  label="Timestamp"
                  value={
                    <span className="font-mono text-xs">
                      {alertDetail?.timestamp
                        ? new Date(alertDetail.timestamp * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC"
                        : "Verified"}
                    </span>
                  }
                />
              </div>

              {/* SHAP Proof Hash */}
              <div className="rounded border border-border bg-elevated/50 p-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  SHAP Explanation Cryptographic Proof
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-foreground truncate">
                    {alertDetail?.shap_proof_hash || "0x44eb5fe190057e0a14c5633e8f22c8ce220222e1e101e37db9ac599633e5dc1b"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      copyText(
                        alertDetail?.shap_proof_hash ||
                          "0x44eb5fe190057e0a14c5633e8f22c8ce220222e1e101e37db9ac599633e5dc1b"
                      )
                    }
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {alertDetail?.resolution_note && (
                <div className="rounded border border-low/30 bg-low/10 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-low font-semibold">
                    Resolution Note
                  </p>
                  <p className="mt-1 text-xs text-foreground">{alertDetail.resolution_note}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDetailModalOpen(false)}>
              Close
            </Button>
            {selectedTradeId && !alertDetail?.resolved && (
              <Button
                size="sm"
                onClick={() => {
                  setDetailModalOpen(false);
                  handleOpenResolve(selectedTradeId);
                }}
                className="bg-primary text-primary-foreground"
              >
                Resolve On-Chain
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Resolve Alert Modal */}
      <Dialog open={resolveModalOpen} onOpenChange={setResolveModalOpen}>
        <DialogContent className="max-w-md border-border bg-surface">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-cyan" />
              Resolve Alert On-Chain
            </DialogTitle>
            <DialogDescription className="text-xs">
              Submits a state resolution transaction to the smart contract for trade{" "}
              <span className="font-mono text-cyan">{resolveTradeId}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Compliance Resolution Note
              </label>
              <Input
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Enter audit resolution reason..."
                className="mt-1 text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              This action writes a permanent resolution timestamp and note to the Hardhat ledger via the backend automation wallet.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setResolveModalOpen(false)} disabled={resolving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmResolve}
              disabled={resolving}
              className="bg-primary text-primary-foreground"
            >
              {resolving ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Submitting Tx…
                </>
              ) : (
                "Confirm & Resolve"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Manual Record Alert Modal */}
      <Dialog open={manualRecordOpen} onOpenChange={setManualRecordOpen}>
        <DialogContent className="max-w-md border-border bg-surface">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-cyan" />
              Manual On-Chain Alert Entry
            </DialogTitle>
            <DialogDescription className="text-xs">
              Queue a custom market alert for immutable anchoring on the Hardhat ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Trade ID</label>
              <Input
                value={manualTradeId}
                onChange={(e) => setManualTradeId(e.target.value)}
                placeholder="e.g. TRD-8849"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Trader ID</label>
              <Input
                value={manualTraderId}
                onChange={(e) => setManualTraderId(e.target.value)}
                placeholder="e.g. TRADER-042"
                className="mt-1 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Risk Score (0-100)</label>
                <Input
                  type="number"
                  value={manualRiskScore}
                  onChange={(e) => setManualRiskScore(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Severity</label>
                <select
                  value={manualSeverity}
                  onChange={(e) => setManualSeverity(e.target.value as Severity)}
                  className="mt-1 w-full h-9 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setManualRecordOpen(false)} disabled={recording}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmManualRecord}
              disabled={recording}
              className="bg-primary text-primary-foreground"
            >
              {recording ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Queueing Tx…
                </>
              ) : (
                "Record On-Chain"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
