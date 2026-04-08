"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export function ConnectButton() {
  const { address, isConnected } = useAccount();

  return (
    <div className="flex flex-col items-center gap-3">
      <RainbowConnectButton />
      {isConnected && address && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">
          Connected: {address}
        </p>
      )}
    </div>
  );
}

export function useWalletAddress() {
  const { address, isConnected } = useAccount();
  return { address, isConnected };
}
