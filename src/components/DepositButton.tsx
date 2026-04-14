"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";

const AAVE_POOL_ABI = [
  {
    type: "function",
    name: "supply",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
] as const;

interface DepositButtonProps {
  poolAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  amount: string;
  decimals?: number;
  symbol?: string;
  protocol: string;
  onDeposited?: (hash: string) => void;
}

type DepositState = "idle" | "pending" | "confirming" | "deposited" | "error";

export function DepositButton({
  poolAddress,
  tokenAddress,
  amount,
  decimals = 6,
  symbol = "USDC",
  protocol,
  onDeposited,
}: DepositButtonProps) {
  const { address } = useAccount();
  const [state, setState] = useState<DepositState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { writeContract, data: hash } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  if (isSuccess && state !== "deposited") {
    setState("deposited");
    onDeposited?.(hash!);
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
          address: poolAddress,
          abi: AAVE_POOL_ABI,
          functionName: "supply",
          args: [tokenAddress, parsedAmount, address || "0x0000000000000000000000000000000000000000", 0],
        },
        {
          onError: (err) => {
            setState("error");
            setErrorMsg(err.message?.slice(0, 120) || "Transaction rejected");
          },
        },
      );
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message.slice(0, 120) : "Failed to prepare transaction");
    }
  }

  const isDisabled = state === "pending" || state === "confirming" || state === "deposited";

  const label = {
    idle: `Deposit ${symbol} into ${protocol}`,
    pending: "Confirm in Wallet...",
    confirming: (
      <span className="flex items-center justify-center gap-2">
        <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Confirming deposit...
      </span>
    ),
    deposited: (
      <span className="flex items-center justify-center gap-1.5">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        You&apos;re earning yield!
      </span>
    ),
    error: "Retry Deposit",
  }[state];

  const containerClass = {
    idle: "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg shadow-green-500/10",
    pending: "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/10 opacity-80",
    confirming: "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/10",
    deposited: "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20",
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

      {state === "deposited" && hash && (
        <p className="text-xs text-cyan-400 font-mono text-center truncate" title={hash}>
          tx: {hash.slice(0, 10)}...{hash.slice(-8)}
        </p>
      )}

      {state === "error" && errorMsg && (
        <p className="text-xs text-red-400 text-center">{errorMsg}</p>
      )}

      {state === "deposited" && (
        <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-3 text-center">
          <p className="text-sm text-cyan-300">
            Your {amount} {symbol} is now earning {protocol} yield.
          </p>
        </div>
      )}
    </div>
  );
}
