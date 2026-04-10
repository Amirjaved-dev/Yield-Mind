"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { parseAbi } from "viem";

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const AAVE_POOL_ABI = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
]);

const COMPOUND_COMET_ABI = parseAbi([
  "function supply(address asset, uint256 amount)",
  "function withdraw(address asset, uint256 amount)",
]);

export interface TransactionData {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  chain_id: number;
  gas_estimate: string;
  gas_cost_usd: string;
  description: string;
  protocol: string;
  action: "approve" | "deposit" | "withdraw";
  asset: string;
  amount: string;
}

export interface DepositPreparation {
  transaction: TransactionData;
  needs_approval: boolean;
  approval_transaction?: TransactionData;
  protocol: string;
  chain: string;
  asset: string;
  amount: string;
  estimated_apy: string;
  risk_level: string;
}

export interface WithdrawPreparation {
  transaction: TransactionData;
  protocol: string;
  chain: string;
  asset: string;
  amount: string;
  withdraw_all: boolean;
  current_value_usd: string;
}

type FlowState = "idle" | "preparing" | "approving" | "depositing" | "withdrawing" | "success" | "error";

interface UseTransactionFlowResult {
  state: FlowState;
  error: string | null;
  txHash: string | null;
  approvalHash: string | null;
  executeDeposit: (preparation: DepositPreparation) => Promise<void>;
  executeWithdraw: (preparation: WithdrawPreparation) => Promise<void>;
  reset: () => void;
}

export function useTransactionFlow(): UseTransactionFlowResult {
  const { address, chain: currentChain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  
  const [state, setState] = useState<FlowState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);

  const ensureCorrectChain = useCallback(async (targetChainId: number) => {
    if (currentChain?.id !== targetChainId) {
      await switchChainAsync?.({ chainId: targetChainId });
    }
  }, [currentChain, switchChainAsync]);

  const executeDeposit = useCallback(async (preparation: DepositPreparation) => {
    if (!address) {
      setError("Wallet not connected");
      setState("error");
      return;
    }

    setState("preparing");
    setError(null);
    setTxHash(null);
    setApprovalHash(null);

    try {
      await ensureCorrectChain(preparation.transaction.chain_id);

      if (preparation.needs_approval && preparation.approval_transaction) {
        setState("approving");
        
        const approvalTx = preparation.approval_transaction;
        const hash = await writeContractAsync({
          address: approvalTx.to,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [
            preparation.transaction.to,
            BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
          ],
        });
        
        setApprovalHash(hash);
      }

      setState("depositing");
      
      const tx = preparation.transaction;
      const isAave = preparation.protocol.toLowerCase().includes("aave");
      const isCompound = preparation.protocol.toLowerCase().includes("compound");
      
      let hash: `0x${string}`;
      
      if (isAave) {
        const assetAddress = tx.to;
        hash = await writeContractAsync({
          address: tx.to,
          abi: AAVE_POOL_ABI,
          functionName: "supply",
          args: [
            assetAddress,
            BigInt(Math.floor(parseFloat(preparation.amount) * 1e6)),
            address,
            0,
          ],
        });
      } else if (isCompound) {
        hash = await writeContractAsync({
          address: tx.to,
          abi: COMPOUND_COMET_ABI,
          functionName: "supply",
          args: [
            tx.to,
            BigInt(Math.floor(parseFloat(preparation.amount) * 1e6)),
          ],
        });
      } else {
        throw new Error(`Unsupported protocol: ${preparation.protocol}`);
      }

      setTxHash(hash);
      setState("success");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Transaction failed";
      if (errorMessage.includes("User rejected") || errorMessage.includes("User denied")) {
        setError("Transaction rejected by user");
      } else {
        setError(errorMessage);
      }
      setState("error");
    }
  }, [address, ensureCorrectChain, writeContractAsync]);

  const executeWithdraw = useCallback(async (preparation: WithdrawPreparation) => {
    if (!address) {
      setError("Wallet not connected");
      setState("error");
      return;
    }

    setState("preparing");
    setError(null);
    setTxHash(null);
    setApprovalHash(null);

    try {
      await ensureCorrectChain(preparation.transaction.chain_id);
      setState("withdrawing");

      const tx = preparation.transaction;
      const isAave = preparation.protocol.toLowerCase().includes("aave");
      const isCompound = preparation.protocol.toLowerCase().includes("compound");

      let hash: `0x${string}`;
      const amountBigInt = preparation.withdraw_all
        ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
        : BigInt(Math.floor(parseFloat(preparation.amount) * 1e6));

      if (isAave) {
        hash = await writeContractAsync({
          address: tx.to,
          abi: AAVE_POOL_ABI,
          functionName: "withdraw",
          args: [tx.to, amountBigInt, address],
        });
      } else if (isCompound) {
        hash = await writeContractAsync({
          address: tx.to,
          abi: COMPOUND_COMET_ABI,
          functionName: "withdraw",
          args: [tx.to, amountBigInt],
        });
      } else {
        throw new Error(`Unsupported protocol: ${preparation.protocol}`);
      }

      setTxHash(hash);
      setState("success");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Transaction failed";
      if (errorMessage.includes("User rejected") || errorMessage.includes("User denied")) {
        setError("Transaction rejected by user");
      } else {
        setError(errorMessage);
      }
      setState("error");
    }
  }, [address, ensureCorrectChain, writeContractAsync]);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setTxHash(null);
    setApprovalHash(null);
  }, []);

  return {
    state,
    error,
    txHash,
    approvalHash,
    executeDeposit,
    executeWithdraw,
    reset,
  };
}
