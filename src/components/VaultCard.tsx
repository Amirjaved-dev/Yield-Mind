"use client";

import { useState } from "react";
import { ApproveButton } from "./ApproveButton";
import { DepositButton } from "./DepositButton";

interface VaultCardProps {
  protocol: string;
  chain: string;
  apy: number;
  tvl: string;
  riskLevel: "low" | "medium" | "high";
  reasoning: string;
  tokenAddress?: `0x${string}`;
  spenderAddress?: `0x${string}`;
  amount?: string;
  symbol?: string;
  onApproved?: (hash: string) => void;
  onDeposited?: (hash: string) => void;
}

const RISK_CONFIG = {
  low: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/20",
    label: "Low Risk",
    dot: "bg-green-400",
  },
  medium: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    label: "Medium Risk",
    dot: "bg-amber-400",
  },
  high: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    label: "High Risk",
    dot: "bg-red-400",
  },
};

export function VaultCard({
  protocol,
  chain,
  apy,
  tvl,
  riskLevel,
  reasoning,
  tokenAddress,
  spenderAddress,
  amount,
  symbol,
  onApproved,
  onDeposited,
}: VaultCardProps) {
  const risk = RISK_CONFIG[riskLevel];
  const [isApproved, setIsApproved] = useState(false);

  return (
    <div className={`rounded-xl border ${risk.border} ${risk.bg} p-5 flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold text-zinc-100">{protocol}</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${risk.bg} ${risk.text}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${risk.dot}`} />
              {risk.label}
            </span>
          </div>
          <span className="text-sm text-zinc-400 font-mono">{chain}</span>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-green-400 font-mono">
            {apy.toFixed(1)}%
          </div>
          <div className="text-xs text-zinc-500">APY</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-black/30 p-3">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">TVL</div>
          <div className="text-sm font-semibold text-zinc-200 font-mono">{tvl}</div>
        </div>
        <div className="rounded-lg bg-black/30 p-3">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">Chain</div>
          <div className="text-sm font-semibold text-zinc-200 font-mono">{chain}</div>
        </div>
        <div className="rounded-lg bg-black/30 p-3">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">Risk</div>
          <div className={`text-sm font-semibold capitalize ${risk.text}`}>{riskLevel}</div>
        </div>
      </div>

      <div className="rounded-lg bg-black/25 border border-white/5 p-3.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Agent Reasoning</span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{reasoning}</p>
      </div>

      {tokenAddress && spenderAddress && amount ? (
        <div className="flex flex-col gap-3">
          <ApproveButton
            tokenAddress={tokenAddress}
            spenderAddress={spenderAddress}
            amount={amount}
            symbol={symbol || "USDC"}
            onApproved={(hash) => {
              setIsApproved(true);
              onApproved?.(hash);
            }}
          />
          {isApproved && (
            <DepositButton
              poolAddress={spenderAddress}
              tokenAddress={tokenAddress}
              amount={amount}
              symbol={symbol || "USDC"}
              protocol={protocol}
              onDeposited={onDeposited}
            />
          )}
        </div>
      ) : onApproved ? (
        <button
          onClick={() => onApproved("")}
          className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-black hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/10"
        >
          Approve & Execute
        </button>
      ) : null}
    </div>
  );
}
