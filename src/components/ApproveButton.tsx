"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface ApproveButtonProps {
  tokenAddress: `0x${string}`;
  spenderAddress: `0x${string}`;
  amount: string;
  decimals?: number;
  symbol?: string;
  onApproved?: (hash: string) => void;
}

type ApprovalState = "idle" | "pending" | "confirming" | "approved" | "error";

export function ApproveButton({
  tokenAddress,
  spenderAddress,
  amount,
  decimals = 6,
  symbol = "USDC",
  onApproved,
}: ApproveButtonProps) {
  const [state, setState] = useState<ApprovalState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { writeContract, data: hash } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  if (isSuccess && state !== "approved") {
    setState("approved");
    onApproved?.(hash!);
  }

  if (isConfirming && state === "pending") {
    setState("confirming");
  }

  function handleClick() {
    setErrorMsg(null);
    setState("pending");

    try {
      const parsedAmount = parseUnits(amount, decimals);
      writeContract(
        {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spenderAddress, parsedAmount],
        },
        {
          onError: (err) => {
            setState("error");
            setErrorMsg(err.message?.slice(0, 120) || "Transaction rejected");
          },
          onSuccess: () => {
            setState("pending");
          },
        },
      );
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message.slice(0, 120) : "Failed to prepare transaction");
    }
  }

  const isDisabled = state === "pending" || state === "confirming" || state === "approved";

  const label = {
    idle: `Approve ${symbol}`,
    pending: "Confirm in Wallet...",
    confirming: (
      <span className="flex items-center justify-center gap-2">
        <span className="inline-block w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
        Waiting for confirmation...
      </span>
    ),
    approved: (
      <span className="flex items-center justify-center gap-1.5">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Approved — Ready to Deposit
      </span>
    ),
    error: "Retry Approval",
  }[state];

  const containerClass = {
    idle: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-lg shadow-amber-500/10",
    pending: "bg-gradient-to-r from-amber-600 to-orange-600 text-black shadow-lg shadow-amber-500/10 opacity-80",
    confirming: "bg-gradient-to-r from-amber-600 to-orange-600 text-black shadow-lg shadow-amber-500/10",
    approved: "bg-gradient-to-r from-green-500 to-emerald-500 text-black shadow-lg shadow-green-500/10",
    error: "bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-400 hover:to-rose-400 shadow-lg shadow-red-500/10",
  }[state];

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed ${containerClass}`}
      >
        {label}
      </button>

      {state === "confirming" && hash && (
        <p className="text-xs text-zinc-500 font-mono text-center truncate" title={hash}>
          tx: {hash.slice(0, 10)}...{hash.slice(-8)}
        </p>
      )}

      {state === "error" && errorMsg && (
        <p className="text-xs text-red-400 text-center">{errorMsg}</p>
      )}
    </div>
  );
}
