"use client";

import { useState } from "react";
import {
  Check,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Zap,
  Shield,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type {
  DepositPreparation,
  WithdrawPreparation,
} from "@/hooks/useTransactionFlow";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  42161: "Arbitrum",
  10: "Optimism",
  8453: "Base",
  137: "Polygon",
  43114: "Avalanche",
  56: "BNB Chain",
};

const RISK_CONFIG = {
  low: { color: "text-green-400", bg: "bg-green-500/10", label: "Low Risk" },
  medium: { color: "text-amber-400", bg: "bg-amber-500/10", label: "Medium Risk" },
  high: { color: "text-red-400", bg: "bg-red-500/10", label: "High Risk" },
};

type ActionCardState = "ready" | "executing" | "success" | "error";

interface ActionCardProps {
  type: "deposit" | "withdraw";
  preparation: DepositPreparation | WithdrawPreparation;
  onConfirm: (prep: DepositPreparation | WithdrawPreparation, type: "deposit" | "withdraw") => Promise<void>;
}

export function ActionCard({ type, preparation, onConfirm }: ActionCardProps) {
  const [state, setState] = useState<ActionCardState>("ready");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const isDeposit = type === "deposit";
  const prep = preparation as DepositPreparation;
  const withdrawPrep = preparation as WithdrawPreparation;
  const risk = RISK_CONFIG[(isDeposit ? prep.risk_level : "medium") as keyof typeof RISK_CONFIG] || RISK_CONFIG.medium;
  const tx = isDeposit ? prep.transaction : withdrawPrep.transaction;
  const chainName = tx?.chain_id ? CHAIN_NAMES[tx.chain_id] : (isDeposit ? prep.chain : withdrawPrep.chain);
  const isComposer = !!tx?.is_composer;

  const handleConfirm = async () => {
    setState("executing");
    setError(null);
    try {
      await onConfirm(preparation, type);
      setState("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setError(msg);
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-4 mt-3">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-500/15">
            <Check size={13} className="text-green-400" />
          </div>
          <span className="text-sm font-semibold text-green-300">Transaction Submitted</span>
        </div>
        <p className="text-xs text-gray-400 ml-8.5">
          Your {isDeposit ? prep.amount : withdrawPrep.amount} {isDeposit ? prep.asset : withdrawPrep.asset}{" "}
          {isDeposit ? "deposited into" : "withdrawn from"} {isDeposit ? prep.protocol : withdrawPrep.protocol}
        </p>
        {txHash && (
          <a
            href={`${tx?.chain_id === 1 ? "https://etherscan.io/tx/" : tx?.chain_id === 8453 ? "https://basescan.org/tx/" : tx?.chain_id === 42161 ? "https://arbiscan.io/tx/" : tx?.chain_id === 10 ? "https://optimistic.etherscan.io/tx/" : tx?.chain_id === 137 ? "https://polygonscan.com/tx/" : tx?.chain_id === 43114 ? "https://snowtrace.io/tx/" : tx?.chain_id === 56 ? "https://bscscan.com/tx/" : "https://etherscan.io/tx/"}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#88fff7] hover:underline ml-8.5 mt-1.5"
          >
            View on explorer <ExternalLink size={11} />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden mt-3 transition-colors",
      state === "error" ? "border-red-500/20 bg-red-500/[0.03]" : "border-white/10 bg-white/[0.02]",
    )}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-white/5 hover:bg-white/[0.025] transition-colors"
      >
        <div className={cn(
          "flex items-center justify-center h-5 w-5 rounded-full shrink-0",
          isDeposit ? "bg-[#88fff7]/10" : "bg-blue-500/10",
        )}>
          {isDeposit ? (
            <Zap size={11} className="text-[#88fff7]/70" />
          ) : (
            <Zap size={11} className="text-blue-400/70" />
          )}
        </div>
        <span className="text-sm font-medium text-white/90 flex-1 text-left">
          {isDeposit ? `Deposit ${prep.amount} ${prep.asset}` : `Withdraw ${withdrawPrep.amount} ${withdrawPrep.asset}`}
        </span>
        <span className={cn("text-[10px] px-1.5 py-px rounded font-medium", risk.bg, risk.color)}>
          {risk.label}
        </span>
        {expanded ? <ChevronUp size={13} className="text-white/25" /> : <ChevronDown size={13} className="text-white/25" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Protocol</p>
              <p className="text-sm font-medium text-white/80 mt-0.5">{isDeposit ? prep.protocol : withdrawPrep.protocol}</p>
            </div>
            <div className="rounded-lg bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Network</p>
              <p className="text-sm font-medium text-white/80 mt-0.5">{chainName}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Amount</p>
              <p className="text-base font-bold text-[#88fff7] mt-0.5">
                {isDeposit ? prep.amount : withdrawPrep.amount}{" "}
                <span className="text-sm font-normal text-white/50">{isDeposit ? prep.asset : withdrawPrep.asset}</span>
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">{isDeposit ? "Est. APY" : "Value"}</p>
              <p className="text-sm font-medium text-green-400 mt-0.5">
                {isDeposit ? prep.estimated_apy : withdrawPrep.current_value_usd}
              </p>
            </div>
          </div>

          {tx && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/[0.02] px-3 py-2">
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Est. Gas</p>
                <p className="text-sm font-medium text-white/60 mt-0.5">{tx.gas_cost_usd}</p>
              </div>
              <div className="rounded-lg bg-white/[0.02] px-3 py-2">
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Gas Limit</p>
                <p className="text-sm font-medium text-white/40 mt-0.5">{tx.gas_estimate}</p>
              </div>
            </div>
          )}

          {isDeposit && prep.needs_approval && (
            <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.03] p-2.5 flex items-start gap-2">
              <AlertTriangle size={13} className="text-amber-400/70 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-300/70">
                Approval required — you&apos;ll confirm 2 transactions in your wallet (approve + {isComposer ? "start the Composer route" : "deposit"})
              </p>
            </div>
          )}

          {isComposer && (
            <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/[0.03] p-2.5">
              <p className="text-[11px] text-cyan-200/80">
                {isDeposit
                  ? prep.needs_approval
                    ? "After approval, LI.FI Composer bundles the swap, bridge, and deposit into one routed transaction."
                    : "LI.FI Composer bundles the swap, bridge, and deposit into one routed transaction and tracks the destination leg for you."
                  : "LI.FI Composer bundles the vault exit and any routing steps into one withdrawal transaction."}
              </p>
            </div>
          )}

          {state === "error" && error && (
            <div className="rounded-lg border border-red-500/15 bg-red-500/[0.03] p-2.5 flex items-start gap-2">
              <X size={13} className="text-red-400/70 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300/80">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={state === "executing"}
            className={cn(
              "w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
              state === "executing"
                ? "bg-white/5 text-white/40 cursor-wait"
                : isDeposit
                  ? "bg-[#88fff7]/10 border border-[#88fff7]/20 text-[#88fff7] hover:bg-[#88fff7]/18 active:bg-[#88fff7]/25"
                  : "bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/18 active:bg-blue-500/25",
            )}
          >
            {state === "executing" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {isDeposit && prep.needs_approval ? "Preparing..." : "Confirm in Wallet..."}
              </>
            ) : isDeposit ? (
              <>
                <Shield size={13} />
                {isComposer
                  ? prep.needs_approval
                    ? "Approve & Start Composer Route"
                    : "Start Composer Route"
                  : prep.needs_approval
                    ? "Approve & Deposit"
                    : "Confirm Deposit"}
              </>
            ) : (
              <>
                <Shield size={13} />
                {isComposer ? "Start Composer Withdrawal" : "Confirm Withdrawal"}
              </>
            )}
          </button>

          <p className="text-[9px] text-white/15 text-center -mb-1">
            DeFi protocols carry smart contract risk. Only use capital you can afford to put at risk.
          </p>
        </div>
      )}
    </div>
  );
}
