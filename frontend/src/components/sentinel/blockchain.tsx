import { useState } from "react";
import { Blocks, Check, Copy, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSentinel } from "@/store/sentinel";
import type { Alert, BlockchainRecord } from "@/types/sentinel";
import { KeyValue } from "./states";
import { Chip } from "./badges";

export function shortHash(hash: string) {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

export function AnchoredBadge({ hash }: { hash: string }) {
  return (
    <Chip tone="low" className="normal-case">
      <ShieldCheck className="h-3 w-3" />
      <span className="font-mono">Blockchain Anchored · {shortHash(hash)}</span>
    </Chip>
  );
}

/** Confirmation modal → writes an immutable audit record on confirm. */
export function AnchorFraudDialog({
  alert,
  open,
  onOpenChange,
  trigger,
}: {
  alert: Alert;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger?: string;
}) {
  const { anchorCase, user, autoAnchorThreshold } = useSentinel();
  const [phase, setPhase] = useState<"confirm" | "writing" | "done">("confirm");
  const [record, setRecord] = useState<BlockchainRecord | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = (v: boolean) => {
    onOpenChange(v);
    if (!v) setTimeout(() => setPhase("confirm"), 250);
  };

  const confirm = () => {
    setPhase("writing");
    setTimeout(() => {
      setRecord(anchorCase(alert, alert.reason));
      setPhase("done");
    }, 1400);
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-lg border-border bg-surface">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Blocks className="h-4 w-4 text-cyan" />
            {phase === "done" ? "Immutable record written" : "Write immutable fraud record"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {phase === "done"
              ? "This case is now permanently anchored and cannot be altered or deleted."
              : `Triggered by ${trigger ?? "investigator confirmation"}. Auto-anchor threshold is ${autoAnchorThreshold}% model confidence.`}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded border border-border bg-background/50 px-3 py-1">
          <KeyValue label="Case ID" value={<span className="font-mono">{alert.case_id}</span>} />
          <KeyValue label="Trader" value={<span className="font-mono">{alert.trader_id}</span>} />
          <KeyValue label="Stock" value={<span className="font-mono">{alert.stock}</span>} />
          <KeyValue label="Fraud type" value={alert.fraud_type} />
          <KeyValue
            label="Confidence"
            value={<span className="font-mono">{Math.round(alert.fraud_probability * 100)}%</span>}
          />
          <KeyValue label="Confirming user" value={`${user?.name ?? "System"} · ${user?.role ?? "Engine"}`} />
          {record && (
            <>
              <KeyValue
                label="Tx hash"
                value={
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(record.tx_hash);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    }}
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-cyan hover:underline"
                  >
                    {shortHash(record.tx_hash)}
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                }
              />
              <KeyValue label="Block" value={<span className="font-mono">#{record.block.toLocaleString()}</span>} />
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{alert.reason}</p>

        <DialogFooter className="gap-2 sm:gap-2">
          {phase === "done" ? (
            <Button onClick={() => reset(false)} className="bg-primary text-primary-foreground">
              Close
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => reset(false)} disabled={phase === "writing"}>
                Cancel
              </Button>
              <Button
                onClick={confirm}
                disabled={phase === "writing"}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {phase === "writing" ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Broadcasting…
                  </>
                ) : (
                  "Confirm & anchor"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BlockchainLogCard({ record, className }: { record: BlockchainRecord; className?: string }) {
  return (
    <div className={cn("panel p-3.5 transition-colors hover:border-cyan/40", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-cyan">{shortHash(record.tx_hash)}</p>
          <p className="mt-1 text-[13px] text-foreground">
            {record.fraud_type} · <span className="font-mono">{record.stock}</span>
          </p>
        </div>
        <Chip tone="low">
          <ShieldCheck className="h-3 w-3" /> Anchored
        </Chip>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <span>Case {record.case_id}</span>
        <span>Trader {record.trader_id}</span>
        <span>Confidence {record.confidence}%</span>
        <span>Block #{record.block.toLocaleString()}</span>
      </div>
      <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
        {record.confirmed_by} · {record.confirmed_role} ·{" "}
        {new Date(record.timestamp).toISOString().replace("T", " ").slice(0, 19)} UTC
      </p>
    </div>
  );
}
