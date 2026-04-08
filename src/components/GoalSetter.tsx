"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

export interface GoalInput {
  goal: string;
  amount: string;
}

interface GoalSetterProps {
  onSubmit: (input: GoalInput) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  "Find safest USDC vault above 5% APY on Arbitrum",
  "Maximize yield on stablecoins with low risk",
  "Best ETH staking options across L2s",
  "Diversify 10k USDC across multiple protocols",
];

export function GoalSetter({ onSubmit, disabled }: GoalSetterProps) {
  const { isConnected } = useAccount();
  const [goal, setGoal] = useState("");
  const [amount, setAmount] = useState("");

  function handleSubmit() {
    if (!goal.trim() || !isConnected || disabled) return;
    onSubmit({ goal: goal.trim(), amount: amount.trim() });
  }

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-8 text-center text-zinc-500 font-mono text-sm">
        Connect your wallet to set a goal
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider font-mono">
            Strategy
          </label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="e.g., Find safest USDC vault above 5% APY on Arbitrum"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors"
            disabled={disabled}
          />
        </div>

        <div className="sm:w-40 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider font-mono">
            Amount
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="e.g., 5000"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors"
            disabled={disabled}
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleSubmit}
            disabled={disabled || !goal.trim()}
            className="w-full sm:w-auto rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-mono whitespace-nowrap"
          >
            {disabled ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Running...
              </span>
            ) : (
              "Run Agent"
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setGoal(suggestion)}
            disabled={disabled}
            className="rounded-md border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors font-mono disabled:opacity-40"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
