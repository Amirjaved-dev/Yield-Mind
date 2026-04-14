"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useSendTransaction, useSwitchChain } from "wagmi";
import { parseAbi, encodeFunctionData, createPublicClient, http } from "viem";

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const AAVE_POOL_ABI = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) payable",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
]);

const COMPOUND_COMET_ABI = parseAbi([
  "function supply(address asset, uint256 amount)",
  "function withdraw(address asset, uint256 amount)",
]);

const MORPHO_WITHDRAW_ABI = parseAbi([
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
]);

export interface TransactionData {
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

type FlowState = "idle" | "preparing" | "approving" | "depositing" | "withdrawing" | "confirming" | "success" | "error";

interface UseTransactionFlowResult {
  state: FlowState;
  error: string | null;
  txHash: string | null;
  approvalHash: string | null;
  executeDeposit: (preparation: DepositPreparation) => Promise<void>;
  executeWithdraw: (preparation: WithdrawPreparation) => Promise<void>;
  reset: () => void;
}

const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  ETH: 18,
  WETH: 18,
  WBTC: 8,
  stETH: 18,
};

const CHAIN_CONFIG: Record<number, { name: string; weth: string; rpc: string }> = {
  1:     { name: "ethereum",  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", rpc: "https://eth.llamarpc.com" },
  10:    { name: "optimism",  weth: "0x4200000000000000000000000000000000000006", rpc: "https://mainnet.optimism.io" },
  56:    { name: "bnb",       weth: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", rpc: "https://bsc-dataseed.binance.org" },
  137:   { name: "polygon",   weth: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", rpc: "https://polygon-rpc.com" },
  42161: { name: "arbitrum",  weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", rpc: "https://arb1.arbitrum.io/rpc" },
  43114: { name: "avalanche", weth: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", rpc: "https://api.avax.network/ext/bc/C/rpc" },
  8453:  { name: "base",      weth: "0x4200000000000000000000000000000000000006", rpc: "https://mainnet.base.org" },
};

const NATIVE_ASSETS = ["ETH", "MATIC", "AVAX", "BNB"];

async function fetchComposerStatus(params: {
  txHash: string;
  fromChainId?: number;
  toChainId?: number;
}): Promise<{ status: string; substatusMessage?: string }> {
  const searchParams = new URLSearchParams({ path: "status", txHash: params.txHash });
  if (params.fromChainId) searchParams.set("fromChain", String(params.fromChainId));
  if (params.toChainId) searchParams.set("toChain", String(params.toChainId));

  const res = await fetch(`/api/lifi-proxy?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LI.FI status error ${res.status}: ${errText}`);
  }

  return await res.json();
}

export function useTransactionFlow(): UseTransactionFlowResult {
  const { address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();

  const [state, setState] = useState<FlowState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);

  const ensureCorrectChain = useCallback(async (targetChainId: number) => {
    try {
      await switchChainAsync?.({ chainId: targetChainId });
    } catch {
      // already on correct chain or user rejected
    }
  }, [switchChainAsync]);

  const getPublicClient = useCallback((chainId: number) => {
    const chainConfig = CHAIN_CONFIG[chainId] || CHAIN_CONFIG[8453];
    return createPublicClient({
      transport: http(chainConfig.rpc),
    });
  }, []);

  const waitForOnchainReceipt = useCallback(async (chainId: number, hash: `0x${string}`) => {
    const publicClient = getPublicClient(chainId);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      throw new Error("Transaction reverted on-chain.");
    }
    return receipt;
  }, [getPublicClient]);

  const waitForComposerCompletion = useCallback(async (tx: TransactionData, hash: `0x${string}`) => {
    if (!tx.is_composer) return;

    const deadline = Date.now() + 8 * 60_000;

    while (Date.now() < deadline) {
      const status = await fetchComposerStatus({
        txHash: hash,
        fromChainId: tx.chain_id,
        toChainId: tx.destination_chain_id,
      });

      if (status.status === "DONE") {
        return;
      }

      if (status.status === "FAILED") {
        throw new Error(status.substatusMessage || "LI.FI Composer route failed.");
      }

      await new Promise((resolve) => setTimeout(resolve, 4_000));
    }

    throw new Error("Timed out waiting for LI.FI Composer to complete on the destination chain.");
  }, []);

  const executeDeposit = useCallback(async (rawPreparation: DepositPreparation) => {
    if (!address) {
      setError("Wallet not connected");
      setState("error");
      throw new Error("Wallet not connected");
    }

    const prep = rawPreparation as unknown as Record<string, unknown>;
    const tx = prep.transaction as TransactionData;
    const approvalTx = prep.approval_transaction as TransactionData | undefined;

    setState("preparing");
    setError(null);
    setTxHash(null);
    setApprovalHash(null);

    try {
      const chainId = tx.chain_id;
      await ensureCorrectChain(chainId);

      const protocol = (prep.protocol as string).toLowerCase();
      const asset = (prep.asset as string).toUpperCase();
      const amountStr = prep.amount as string;
      const decimals = TOKEN_DECIMALS[asset] || 18;
      const amountRaw = BigInt(Math.floor(parseFloat(amountStr) * 10 ** decimals));
      const chainConfig = CHAIN_CONFIG[chainId] || CHAIN_CONFIG[8453];
      const isNative = NATIVE_ASSETS.includes(asset);
      const txValue = tx.value;

      console.log("[executeDeposit]", {
        protocol, asset, amount: amountStr, decimals,
        amountRaw: amountRaw.toString(),
        poolAddress: tx.to as string,
        chainId: chainId.toString(),
        chainName: chainConfig.name,
        isNative,
        needsApproval: prep.needs_approval,
      });

      // Step 1: Approval (if needed and not native)
      if (prep.needs_approval && approvalTx && !isNative) {
        setState("approving");
        console.log("[executeDeposit] submitting prepared approval tx", approvalTx.to);
        const approvalHash = await sendTransactionAsync({
          to: approvalTx.to,
          data: approvalTx.data,
          value: approvalTx.value,
        });
        setApprovalHash(approvalHash);
        console.log("[executeDeposit] approval tx:", approvalHash);
        await waitForOnchainReceipt(chainId, approvalHash);
      } else if (prep.needs_approval && !isNative) {
        let tokenForApproval: `0x${string}` | undefined;
        try {
          tokenForApproval = await getTokenAddress(chainConfig.name, asset);
        } catch (e) {
          console.warn("[executeDeposit] could not resolve token for approval:", e);
        }

        if (tokenForApproval) {
          console.log("[executeDeposit] approving", tokenForApproval, "for pool", tx.to);
          const approvalHash = await writeContractAsync({
            address: tokenForApproval,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [tx.to, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
          });
          setApprovalHash(approvalHash);
          console.log("[executeDeposit] approval tx:", approvalHash);
          await waitForOnchainReceipt(chainId, approvalHash);
        }
      }

      // Step 2: Deposit
      setState("depositing");
      const poolAddress = tx.to;

      let hash: `0x${string}`;

      if (protocol.includes("aave")) {
        if (isNative) {
          // Native token → deposit() payable with msg.value = amount
          // viem encodeFunctionData handles selector + ABI encoding correctly
          const data = encodeFunctionData({
            abi: AAVE_POOL_ABI,
            functionName: "deposit",
            args: [
              chainConfig.weth as `0x${string}`,
              amountRaw,
              address as `0x${string}`,
              0,
            ],
          });

          console.log("[executeDeposit] native deposit calldata:", data);
          console.log("[executeDeposit] msg.value:", amountRaw.toString(), `(${amountStr} ${asset})`);

          hash = await sendTransactionAsync({
            to: poolAddress,
            data,
            value: amountRaw,
          });
        } else {
          // ERC20 → supply()
          const erc20Addr = await getTokenAddress(chainConfig.name, asset);
          console.log("[executeDeposit] ERC20 supply:", erc20Addr, amountRaw.toString());

          hash = await writeContractAsync({
            address: poolAddress,
            abi: AAVE_POOL_ABI,
            functionName: "supply",
            args: [erc20Addr, amountRaw, address as `0x${string}`, 0],
          });
        }
      } else if (protocol.includes("compound")) {
        const erc20Addr = await getTokenAddress(chainConfig.name, asset);
        hash = await writeContractAsync({
          address: poolAddress,
          abi: COMPOUND_COMET_ABI,
          functionName: "supply",
          args: [erc20Addr, amountRaw],
        });
      } else {
        console.log("[executeDeposit] Generic vault deposit to", poolAddress, "protocol:", prep.protocol);
        hash = await sendTransactionAsync({
          to: poolAddress,
          data: tx.data,
          value: txValue,
        });
      }

      console.log("[executeDeposit] deposit tx hash:", hash);
      setTxHash(hash);
      setState("confirming");

      try {
        await waitForOnchainReceipt(chainId, hash);
        await waitForComposerCompletion(tx, hash);
      } catch (receiptErr) {
        const msg = receiptErr instanceof Error ? receiptErr.message : String(receiptErr);
        console.warn("[executeDeposit] receipt check:", msg);
        if (
          msg.includes("reverted") ||
          msg.includes("Composer") ||
          msg.includes("LI.FI") ||
          msg.includes("Timed out")
        ) {
          throw new Error(msg);
        }
      }

      setState("success");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Transaction failed";
      console.error("[executeDeposit] FAILED:", errorMessage);
      if (errorMessage.includes("User rejected") || errorMessage.includes("User denied")) {
        setError("Transaction rejected by user");
      } else {
        setError(errorMessage);
      }
      setState("error");
      throw (err instanceof Error ? err : new Error(errorMessage));
    }
  }, [address, ensureCorrectChain, writeContractAsync, sendTransactionAsync, waitForComposerCompletion, waitForOnchainReceipt]);

  const executeWithdraw = useCallback(async (rawPreparation: WithdrawPreparation) => {
    if (!address) {
      setError("Wallet not connected");
      setState("error");
      throw new Error("Wallet not connected");
    }

    const prep = rawPreparation as unknown as Record<string, unknown>;
    const tx = prep.transaction as TransactionData;

    setState("preparing");
    setError(null);
    setTxHash(null);
    setApprovalHash(null);

    try {
      const chainId = tx.chain_id;
      await ensureCorrectChain(chainId);

      setState("withdrawing");

      const protocol = (prep.protocol as string).toLowerCase();
      const asset = (prep.asset as string).toUpperCase();
      const amountStr = prep.amount as string;
      const decimals = TOKEN_DECIMALS[asset] || 18;
      const withdrawAll = prep.withdraw_all as boolean;
      const amountRaw = withdrawAll
        ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
        : BigInt(Math.floor(parseFloat(amountStr) * 10 ** decimals));

      const chainConfig = CHAIN_CONFIG[chainId] || CHAIN_CONFIG[8453];
      const poolAddress = tx.to;
      const txValue = tx.value;

      let hash: `0x${string}`;

      if (protocol.includes("aave")) {
        const erc20Addr = await getTokenAddress(chainConfig.name, asset);
        hash = await writeContractAsync({
          address: poolAddress,
          abi: AAVE_POOL_ABI,
          functionName: "withdraw",
          args: [erc20Addr, amountRaw, address as `0x${string}`],
        });
      } else if (protocol.includes("compound")) {
        const erc20Addr = await getTokenAddress(chainConfig.name, asset);
        hash = await writeContractAsync({
          address: poolAddress,
          abi: COMPOUND_COMET_ABI,
          functionName: "withdraw",
          args: [erc20Addr, amountRaw],
        });
      } else if (protocol.includes("morpho")) {
        console.log("[executeWithdraw] Morpho withdraw from", poolAddress, "amount:", amountRaw.toString());
        hash = await writeContractAsync({
          address: poolAddress,
          abi: MORPHO_WITHDRAW_ABI,
          functionName: "withdraw",
          args: [amountRaw, address as `0x${string}`, address as `0x${string}`],
        });
      } else {
        console.log("[executeWithdraw] Generic vault withdraw from", poolAddress, "protocol:", prep.protocol);
        hash = await sendTransactionAsync({
          to: poolAddress,
          data: tx.data,
          value: txValue,
        });
      }

      setTxHash(hash);
      setState("confirming");

      try {
        await waitForOnchainReceipt(chainId, hash);
      } catch (receiptErr) {
        const msg = receiptErr instanceof Error ? receiptErr.message : String(receiptErr);
        if (msg.includes("reverted")) {
          throw new Error(msg);
        }
      }

      setState("success");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Transaction failed";
      if (errorMessage.includes("User rejected") || errorMessage.includes("User denied")) {
        setError("Transaction rejected by user");
      } else {
        setError(errorMessage);
      }
      setState("error");
      throw (err instanceof Error ? err : new Error(errorMessage));
    }
  }, [address, ensureCorrectChain, sendTransactionAsync, writeContractAsync, waitForOnchainReceipt]);

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

async function getTokenAddress(chainName: string, asset: string): Promise<`0x${string}`> {
  try {
    const { TOKEN_ADDRESSES: ta } = await import("@/lib/defi-data");
    const tokens = (ta as Record<string, Record<string, string>>)[chainName];
    if (!tokens) throw new Error(`No tokens for chain ${chainName}`);
    const addr = tokens[asset];
    if (!addr || addr === "0x0000000000000000000000000000000000000000") {
      throw new Error(`Token ${asset} not found on ${chainName}`);
    }
    return addr as `0x${string}`;
  } catch (e) {
    throw new Error(`Cannot resolve ${asset} on ${chainName}: ${e instanceof Error ? e.message : e}`);
  }
}
