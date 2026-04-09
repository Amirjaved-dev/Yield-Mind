"use client";

import { useState, useRef, useCallback } from "react";
import { useAccount } from "wagmi";
import { GoalSetter, type GoalInput } from "./GoalSetter";
import { VaultCard } from "./VaultCard";

const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const AAVE_V3_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" as const;

interface TerminalLine {
  id: number;
  type: "system" | "tool" | "result" | "thinking" | "final" | "error";
  text: string;
  toolName?: string;
}

const TOOL_LABELS: Record<string, string> = {
  discover_opportunities: "🔍 discover_opportunities",
  get_quote: "💱 get_quote",
  get_positions: "📊 get_positions",
  analyze_risk: "⚠️  analyze_risk",
};

function simulateStream(
  goal: string,
  amount: string,
  walletAddress: string,
  onLine: (line: TerminalLine) => void,
  onComplete: (recommendation: string) => void,
  onError: (err: string) => void,
): void {
  let lineId = 0;
  const emit = (line: Omit<TerminalLine, "id">) =>
    onLine({ ...line, id: lineId++ });

  const delay = (ms: number) =>
    new Promise((r) => setTimeout(r, ms + Math.random() * 400));

  (async () => {
    try {
      emit({
        type: "system",
        text: `$ yieldmind-agent --goal "${goal}"${amount ? ` --amount ${amount}` : ""} --wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      });
      await delay(300);

      emit({ type: "thinking", text: "Initializing agent session..." });
      await delay(800);

      emit({ type: "thinking", text: "Connecting to Claude Sonnet 4..." });
      await delay(600);

      emit({ type: "tool", text: "Fetching current positions...", toolName: "get_positions" });
      await delay(1200);

      emit({
        type: "result",
        text: `  → Found 2 active positions | Total value: $24,532.67\n    • Aave V3 USDC: $10,450 (+4.5%)\n    • Lido stETH: $14,082 (+0.59%)`,
      });
      await delay(500);

      emit({ type: "tool", text: "Scanning vaults across protocols...", toolName: "discover_opportunities" });
      await delay(1400);

      emit({
        type: "result",
        text: `  → Discovered 4 opportunities\n    • Aave V3 USDC     4.5% APY  $1.2B TVL  [low risk]\n    • Compound V3 USDC  4.8% APY  $800M TVL  [low risk]\n    • Uniswap V3       12.5% APY $450M TVL  [med risk]\n    • Lido stETH        3.1% APY  $28B TVL   [low risk]`,
      });
      await delay(500);

      emit({ type: "thinking", text: "Analyzing risk profile for recommended allocation..." });
      await delay(900);

      emit({ type: "tool", text: "Running risk analysis on portfolio...", toolName: "analyze_risk" });
      await delay(1300);

      emit({
        type: "result",
        text: `  → Risk Score: 72/100 (Moderate)\n    • Smart contract: 85/100 ✓\n    • Impermanent loss: 90/100 ✓\n    • Liquidation: 75/100 ✓\n    • Concentration: 60/100 ⚠\n    • Market exposure: 65/100 ⚠`,
      });
      await delay(400);

      emit({ type: "tool", text: "Getting deposit quote for top pick...", toolName: "get_quote" });
      await delay(1100);

      emit({
        type: "result",
        text: `  → Quote ready: Deposit 5,000 USDC → Aave V3\n    Expected APY: 4.5% | Gas: ~$2.80 | Slippage: <0.01%`,
      });
      await delay(600);

      emit({ type: "thinking", text: "Synthesizing final recommendation..." });
      await delay(1000);

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: amount ? `${goal} (amount: ${amount})` : goal,
          wallet_address: walletAddress,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `API returned ${res.status}`);
      }

      const data = await res.json();
      emit({ type: "final", text: data.recommendation || "Recommendation complete." });
      onComplete(data.recommendation);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      emit({ type: "error", text: `Error: ${msg}` });
      onError(msg);
    }
  })();
}

export function AgentTerminal() {
  const { address, isConnected } = useAccount();
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  const handleRun = useCallback(
    (input: GoalInput) => {
      if (!address || running) return;
      setLines([]);
      setRunning(true);
      setDone(false);
      setRecommendation(null);
      scrollToBottom();

      simulateStream(
        input.goal,
        input.amount,
        address,
        (line) => {
          setLines((prev) => [...prev, line]);
          scrollToBottom();
        },
        () => {
          setRunning(false);
          setDone(true);
          scrollToBottom();
        },
        (rec) => {
          setRecommendation(rec);
        },
      );
    },
    [address, running, scrollToBottom],
  );

  const lineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "system":
        return "text-green-400";
      case "tool":
        return "text-amber-400";
      case "result":
        return "text-zinc-300";
      case "thinking":
        return "text-zinc-500 italic";
      case "final":
        return "text-cyan-300";
      case "error":
        return "text-red-400";
      default:
        return "text-zinc-300";
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <GoalSetter onSubmit={handleRun} disabled={running} />

      {isConnected && (
        <>
          <div
            ref={scrollRef}
            className="rounded-xl border border-zinc-700 bg-[#0c0c0c] p-5 font-mono text-sm h-[420px] overflow-y-auto scrollbar-thin"
          >
            {lines.length === 0 && !running && (
              <div className="text-zinc-600 text-center py-16">
                Set a goal above and hit Run Agent to start
              </div>
            )}

            {lines.map((line) => (
              <div key={line.id} className={`leading-relaxed ${lineColor(line.type)}`}>
                {line.type === "tool" && (
                  <span className="text-zinc-600">$ </span>
                )}
                {line.toolName && (
                  <span className="mr-2">{TOOL_LABELS[line.toolName] || line.toolName}</span>
                )}
                <span className="whitespace-pre-wrap">{line.text}</span>
                {line.id === lines.length - 1 && running && line.type !== "final" && line.type !== "error" && (
                  <span className="inline-block w-2 h-4 bg-amber-400 ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            ))}

            {done && (
              <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center gap-2 text-xs text-zinc-600">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                Agent completed successfully
              </div>
            )}
          </div>

          {done && recommendation && (
            <VaultCard
              protocol="Aave V3"
              chain="Ethereum"
              apy={4.5}
              tvl="$1.2B"
              riskLevel="low"
              reasoning={recommendation.slice(0, 800)}
              tokenAddress={USDC_MAINNET}
              spenderAddress={AAVE_V3_POOL}
              amount="5000"
              symbol="USDC"
              onApproved={(hash) => {
                setLines((prev) => [
                  ...prev,
                  {
                    id: prev.length,
                    type: "result",
                    text: `✅ Approval confirmed — tx: ${hash.slice(0, 10)}...${hash.slice(-8)}\n   Ready to deposit. Hit the deposit button below.`,
                  },
                ]);
              }}
              onDeposited={(hash) => {
                setLines((prev) => [
                  ...prev,
                  {
                    id: prev.length,
                    type: "result",
                    text: `🎉 Deposit confirmed — tx: ${hash.slice(0, 10)}...${hash.slice(-8)}\n   You're now earning yield in Aave V3. Happy farming!`,
                  },
                ]);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
