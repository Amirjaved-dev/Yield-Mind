"use client";

import { useState, useEffect } from "react";
import { useSwitchChain, useAccount } from "wagmi";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";

const CHAINS = [
  { id: 8453, name: "Base", symbol: "BASE", color: "#0052FF", gas: "Low", gasCost: "~$0.05" },
];

interface ChainPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (chainId: number) => void;
}

export function ChainPrompt({ isOpen, onClose, onSelect }: ChainPromptProps) {
  const [selectedChain, setSelectedChain] = useState<number>(8453);
  const [showTestnets, setShowTestnets] = useState(false);
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  useEffect(() => {
    if (isOpen) {
      setSelectedChain(8453);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleContinue = () => {
    if (isConnected) {
      switchChain(
        { chainId: selectedChain },
        {
          onSuccess: () => {
            showToast.chainSwitched(CHAINS.find((c) => c.id === selectedChain)?.name || "");
            onSelect(selectedChain);
            onClose();
          },
          onError: () => {
            showToast.chainSwitchFailed();
            onSelect(selectedChain);
            onClose();
          },
        }
      );
    } else {
      onSelect(selectedChain);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#091615] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">Select Network</h2>
          <p className="text-sm text-gray-400">
            Choose your preferred network to get started with YieldMind
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {CHAINS.map((chain) => (
            <button
              key={chain.id}
              onClick={() => setSelectedChain(chain.id)}
              className={cn(
                "relative flex flex-col items-center p-4 rounded-xl border transition-all",
                selectedChain === chain.id
                  ? "border-[#88fff7]/30 bg-[#88fff7]/5"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
              )}
            >
              {selectedChain === chain.id && (
                <div className="absolute top-2 right-2">
                  <Check size={14} className="text-[#88fff7]" />
                </div>
              )}
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2"
                style={{ backgroundColor: `${chain.color}20`, color: chain.color }}
              >
                {chain.symbol.slice(0, 2)}
              </span>
              <span className="text-sm font-medium text-white mb-1">{chain.name}</span>
              <span className="text-xs text-gray-500">{chain.gasCost} avg</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-6 px-1">
          <input
            type="checkbox"
            id="showTestnets"
            checked={showTestnets}
            onChange={(e) => setShowTestnets(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5"
          />
          <label htmlFor="showTestnets" className="text-sm text-gray-400">
            Show testnets (for development)
          </label>
        </div>

        <button
          onClick={handleContinue}
          disabled={isPending}
          className={cn(
            "w-full py-3 rounded-xl font-medium text-sm transition-all",
            "bg-[#88fff7]/10 border border-[#88fff7]/20 text-[#88fff7]",
            "hover:bg-[#88fff7]/20",
            isPending && "opacity-50 cursor-not-allowed"
          )}
        >
          {isPending ? "Switching..." : "Continue"}
        </button>

        <p className="mt-4 text-xs text-center text-gray-600">
          You can change this later using the network selector
        </p>
      </div>
    </div>
  );
}
