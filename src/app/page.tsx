"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Mic } from "lucide-react";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { ChainSelector } from "@/components/ChainSelector";
import { ChainPrompt } from "@/components/ChainPrompt";
import { usePreferredChain } from "@/hooks/use-preferred-chain";
import { showToast } from "@/lib/toast";

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const { address, isConnected } = useAccount();
  const { preferredChain, setPreferredChain, shouldPrompt } = usePreferredChain();
  const [showChainPrompt, setShowChainPrompt] = useState(false);

  useEffect(() => {
    if (isConnected && shouldPrompt) {
      setShowChainPrompt(true);
    }
  }, [isConnected, shouldPrompt]);

  useEffect(() => {
    if (isConnected && address) {
      showToast.walletConnected(address);
    }
  }, [isConnected, address]);

  function handleSubmit() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    router.push(`/chat?prompt=${encodeURIComponent(trimmedPrompt)}`);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleChainSelect(chainId: number) {
    setPreferredChain(chainId);
    setShowChainPrompt(false);
  }

  return (
    <div className="min-h-screen bg-[#061514] text-white font-sans">
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-white" />
          <span className="text-lg font-semibold tracking-tight">YieldMind</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm">
          <a href="#" className="text-gray-300 hover:text-white transition-colors">FAQ</a>
          <a href="#" className="text-gray-300 hover:text-white transition-colors">Docs</a>
          <a href="#" className="text-gray-300 hover:text-white transition-colors">Protocol</a>
          <a href="#" className="text-[#f59e0b] font-medium">Agent</a>
        </div>

        <div className="flex items-center gap-3">
          <ChainSelector />
          <RainbowConnectButton />
        </div>
      </nav>

      <main>
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/ChatGPT.webp"
              alt=""
              fill
              priority
              aria-hidden="true"
              className="object-cover object-[center_42%] scale-[1.08] md:scale-[1.12] md:object-[center_40%]"
            />
            <div className="absolute inset-0 bg-[#061514]/46 mix-blend-multiply" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,21,20,0.9)_0%,rgba(6,21,20,0.42)_18%,rgba(6,21,20,0.06)_38%,rgba(6,21,20,0.06)_62%,rgba(6,21,20,0.42)_82%,rgba(6,21,20,0.9)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(129,255,247,0.08)_0%,rgba(11,28,27,0.16)_24%,rgba(6,21,20,0.66)_56%,rgba(6,21,20,0.94)_100%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#061514]/54 via-[#061514]/12 to-[#061514]" />
          </div>

          <div className="relative mx-auto flex min-h-[calc(100vh-88px)] max-w-7xl flex-col items-center justify-center px-6 pt-16 pb-24 md:-translate-y-4">
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-[34%] h-[18rem] w-[min(92vw,60rem)] -translate-x-1/2 rounded-full bg-[#081716]/78 blur-3xl md:h-[22rem]"
            />

            <div className="flex w-full max-w-[52rem] flex-col items-center gap-7 md:gap-9">
              <div className="flex max-w-[50rem] flex-col items-center gap-6 md:gap-7">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-center leading-tight">
                  Optimize DeFi yield, with AI.
                </h1>
                <p className="text-base md:text-lg text-gray-200/90 text-center max-w-2xl leading-relaxed">
                  Describe your yield strategy in plain English. YieldMind scans protocols, analyzes risk, and finds the best opportunities across DeFi.
                </p>
              </div>

              <div className="w-full max-w-2xl">
                <div className="rounded-3xl border border-white/10 bg-[#091615]/86 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.52)] ring-1 ring-[#88fff7]/6 backdrop-blur-md">
                  <textarea
                    placeholder="Describe the yield strategy you want to execute..."
                    rows={3}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent text-white placeholder-gray-500 resize-none outline-none text-base leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-3 pt-2">
                    <div className="flex items-center gap-2">
                      <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:bg-white/15 hover:text-white transition-all">
                        <Plus size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!prompt.trim()}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1A2726] border border-white/10 text-sm text-gray-200 hover:bg-[#223231] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                        Run Agent
                      </button>
                    </div>
                    <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:bg-white/15 hover:text-white transition-all">
                      <Mic size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-20 pt-10 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            AI-powered{" "}
            <span className="text-[#f59e0b]">DeFi agent</span>
          </h2>
        </section>
      </main>

      <ChainPrompt
        isOpen={showChainPrompt}
        onClose={() => setShowChainPrompt(false)}
        onSelect={handleChainSelect}
      />
    </div>
  );
}
