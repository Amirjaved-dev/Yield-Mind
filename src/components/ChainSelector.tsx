"use client";

import { useState } from "react";
import { useSwitchChain, useChainId } from "wagmi";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const CHAINS = [
  { id: 1, name: "Ethereum", symbol: "ETH", color: "#627EEA", testnet: false },
  { id: 42161, name: "Arbitrum", symbol: "ARB", color: "#28A0F0", testnet: false },
  { id: 10, name: "Optimism", symbol: "OP", color: "#FF0420", testnet: false },
  { id: 8453, name: "Base", symbol: "BASE", color: "#0052FF", testnet: false },
  { id: 137, name: "Polygon", symbol: "MATIC", color: "#8247E5", testnet: false },
  { id: 43114, name: "Avalanche", symbol: "AVAX", color: "#E84142", testnet: false },
  { id: 56, name: "BNB Chain", symbol: "BNB", color: "#F3BA2F", testnet: false },
];

interface ChainSelectorProps {
  compact?: boolean;
}

export function ChainSelector({ compact = false }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  const currentChain = CHAINS.find((c) => c.id === chainId) || CHAINS[0];
  const mainnets = CHAINS.filter((c) => !c.testnet);
  const testnets = CHAINS.filter((c) => c.testnet);

  const handleSelect = (id: number) => {
    if (id !== chainId) {
      switchChain({ chainId: id });
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className={cn(
          "flex items-center gap-2 rounded-full border bg-[#0d1e1d]/80 backdrop-blur-sm transition-all hover:bg-[#0d1e1d]",
          compact
            ? "h-8 px-3 text-xs border-white/10"
            : "h-10 px-4 text-sm border-white/10 hover:border-[#88fff7]/30",
          isPending && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: currentChain.color }}
        />
        <span className="text-gray-300">
          {compact ? currentChain.symbol : currentChain.name}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "text-gray-500 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#091615] shadow-xl z-50 overflow-hidden">
            <div className="py-1">
              {mainnets.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => handleSelect(chain.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                    chain.id === chainId
                      ? "bg-white/5 text-white"
                      : "text-gray-400 hover:bg-white/[0.03] hover:text-gray-200"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: chain.color }}
                  />
                  <span className="flex-1">{chain.name}</span>
                  {chain.id === chainId && (
                    <Check size={14} className="text-[#88fff7]" />
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-white/5">
              <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/20">
                Testnets
              </div>
              {testnets.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => handleSelect(chain.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                    chain.id === chainId
                      ? "bg-white/5 text-white"
                      : "text-gray-500 hover:bg-white/[0.03] hover:text-gray-300"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 opacity-50"
                    style={{ backgroundColor: chain.color }}
                  />
                  <span className="flex-1">{chain.name}</span>
                  {chain.id === chainId && (
                    <Check size={14} className="text-[#88fff7]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
