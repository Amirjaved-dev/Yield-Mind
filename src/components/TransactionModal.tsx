"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, Check, Loader2, ExternalLink, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type TransactionStep = "preview" | "approving" | "approved" | "signing" | "confirming" | "success" | "error";

interface TransactionData {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  chain_id: number;
  destination_chain_id?: number;
  gas_estimate: string;
  gas_cost_usd: string;
  description: string;
  protocol: string;
  action: "approve" | "deposit" | "withdraw";
  asset: string;
  amount: string;
  is_composer?: boolean;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  transaction?: TransactionData;
  approvalTransaction?: TransactionData;
  needsApproval?: boolean;
  protocol?: string;
  chain?: string;
  asset?: string;
  amount?: string;
  estimatedApy?: string;
  riskLevel?: string;
}

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  42161: "Arbitrum",
  10: "Optimism",
  8453: "Base",
  137: "Polygon",
  43114: "Avalanche",
  56: "BNB Chain",
};

const BLOCK_EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  42161: "https://arbiscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
  137: "https://polygonscan.com/tx/",
  43114: "https://snowtrace.io/tx/",
  56: "https://bscscan.com/tx/",
};

const RISK_CONFIG = {
  low: { color: "text-green-400", bg: "bg-green-500/10", label: "Low Risk" },
  medium: { color: "text-amber-400", bg: "bg-amber-500/10", label: "Medium Risk" },
  high: { color: "text-red-400", bg: "bg-red-500/10", label: "High Risk" },
};

export function TransactionModal({
  isOpen,
  onClose,
  onConfirm,
  transaction,
  approvalTransaction,
  needsApproval = false,
  protocol,
  chain,
  asset,
  amount,
  estimatedApy,
  riskLevel = "medium",
}: TransactionModalProps) {
  const [step, setStep] = useState<TransactionStep>("preview");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setStep("preview");
      setError(null);
      setTxHash(null);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const risk = RISK_CONFIG[riskLevel as keyof typeof RISK_CONFIG] || RISK_CONFIG.medium;
  const chainName = transaction?.chain_id ? CHAIN_NAMES[transaction.chain_id] : chain || "Unknown";
  const destinationChainName = transaction?.destination_chain_id
    ? CHAIN_NAMES[transaction.destination_chain_id]
    : null;
  const isWithdraw = transaction?.action === "withdraw";
  const isComposer = !!transaction?.is_composer;
  const actionLabel = isWithdraw ? "withdrawal" : "deposit";
  const actionPastTense = isWithdraw ? "withdrawn from" : "deposited into";

  const handleConfirm = async () => {
    setError(null);
    
    try {
      if (needsApproval) {
        setStep("approving");
      } else {
        setStep("signing");
      }
      
      await onConfirm();
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setStep("error");
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case "preview":
        return (
          <>
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">Protocol</span>
                      <span className="font-medium text-white">{protocol || "Unknown"}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">Network</span>
                  <span className="font-medium text-white">
                    {destinationChainName ? `${chainName} -> ${destinationChainName}` : chainName}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">Asset</span>
                      <span className="font-medium text-white">{asset || "Unknown"}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">Amount</span>
                      <span className="text-lg font-bold text-[#88fff7]">{amount || "0"} {asset || ""}</span>
                </div>
                {estimatedApy && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">Est. APY</span>
                    <span className="font-medium text-green-400">{estimatedApy}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Risk Level</span>
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium", risk.bg, risk.color)}>
                    {risk.label}
                  </span>
                </div>
              </div>

              {transaction && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Est. Gas Cost</span>
                    <span className="font-medium text-white">{transaction.gas_cost_usd}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Gas Estimate</span>
                    <span className="text-sm text-gray-500">{transaction.gas_estimate}</span>
                  </div>
                </div>
              )}

              {needsApproval && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-200 font-medium">Approval Required</p>
                      <p className="text-xs text-amber-300/70 mt-0.5">
                        You&apos;ll need to approve {asset || "this asset"} for {protocol || "this protocol"} before {isComposer ? "starting the Composer route" : "depositing"}. This is a one-time transaction.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isComposer && (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                  <p className="text-sm text-cyan-200 font-medium">LI.FI Composer Route</p>
                  <p className="text-xs text-cyan-100/70 mt-0.5">
                    {isWithdraw
                      ? "The vault exit and any routing steps are bundled into a single Composer withdrawal transaction."
                      : needsApproval
                        ? "After approval, the swap, bridge, and deposit steps are bundled into a single Composer transaction."
                        : "Swap, bridge, and deposit steps are bundled into a single Composer transaction."}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-gray-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500">
                    DeFi protocols carry smart contract risk. This transaction cannot be reversed once confirmed.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-medium hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl bg-[#88fff7]/10 border border-[#88fff7]/20 text-[#88fff7] font-medium hover:bg-[#88fff7]/20 transition-colors"
              >
                {isComposer
                  ? isWithdraw
                    ? "Start Composer Withdrawal"
                    : needsApproval
                      ? "Approve & Continue"
                      : "Start Composer Route"
                  : isWithdraw
                    ? "Confirm Withdrawal"
                    : "Confirm Deposit"}
              </button>
            </div>
          </>
        );

      case "approving":
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Loader2 size={32} className="text-amber-400 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Approving {asset}</h3>
            <p className="text-sm text-gray-400">
              Confirm the approval transaction in your wallet...
            </p>
          </div>
        );

      case "approved":
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Approved!</h3>
            <p className="text-sm text-gray-400 mb-4">
              {asset} is now approved. Ready to deposit...
            </p>
            <button
              onClick={() => setStep("signing")}
              className="py-3 px-8 rounded-xl bg-[#88fff7]/10 border border-[#88fff7]/20 text-[#88fff7] font-medium hover:bg-[#88fff7]/20 transition-colors"
            >
              Continue to Deposit
            </button>
          </div>
        );

      case "signing":
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-[#88fff7]/10 flex items-center justify-center mx-auto mb-4">
              <Wallet size={32} className="text-[#88fff7] animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Sign Transaction</h3>
            <p className="text-sm text-gray-400">
              Confirm the {actionLabel} transaction in your wallet...
            </p>
          </div>
        );

      case "confirming":
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-[#88fff7]/10 flex items-center justify-center mx-auto mb-4">
              <Loader2 size={32} className="text-[#88fff7] animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Processing Transaction</h3>
            <p className="text-sm text-gray-400">
              {isComposer
                ? isWithdraw
                  ? "Tracking the Composer route until the routed withdrawal completes..."
                  : "Tracking the Composer route until the destination deposit completes..."
                : "Waiting for confirmation..."}
            </p>
          </div>
        );

      case "success":
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Transaction Successful!</h3>
            <p className="text-sm text-gray-400 mb-4">
              Your {amount} {asset} has been {actionPastTense} {protocol}
            </p>
            {txHash && (
              <a
                href={`${BLOCK_EXPLORERS[transaction?.chain_id || 1] || BLOCK_EXPLORERS[1]}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[#88fff7] hover:underline"
              >
                View transaction <ExternalLink size={14} />
              </a>
            )}
            <button
              onClick={onClose}
              className="mt-6 py-3 px-8 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
            >
              Done
            </button>
          </div>
        );

      case "error":
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Transaction Failed</h3>
            <p className="text-sm text-gray-400 mb-4">
              {error || "Something went wrong. Please try again."}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onClose}
                className="py-3 px-6 rounded-xl border border-white/10 text-gray-400 font-medium hover:bg-white/5 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setStep("preview")}
                className="py-3 px-6 rounded-xl bg-[#88fff7]/10 border border-[#88fff7]/20 text-[#88fff7] font-medium hover:bg-[#88fff7]/20 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#091615] shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">
            {step === "preview" ? "Confirm Transaction" : step.charAt(0).toUpperCase() + step.slice(1)}
          </h2>
          {step === "preview" || step === "error" ? (
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          ) : null}
        </div>

        <div className="p-4">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
