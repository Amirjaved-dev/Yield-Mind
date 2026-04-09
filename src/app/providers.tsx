"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";

const config = getDefaultConfig({
  appName: "YieldMind",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "YOUR_WALLETCONNECT_PROJECT_ID_HERE",
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});

type Props = {
  children: React.ReactNode;
  initialState?: unknown | undefined;
};

export function Providers({ children, initialState }: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  const [hydrated, setHydrated] = useState(false);
  const hydrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    hydrateTimerRef.current = setTimeout(() => {
      setHydrated(true);
    }, 0);

    return () => {
      if (hydrateTimerRef.current) clearTimeout(hydrateTimerRef.current);
    };
  }, []);

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {hydrated ? children : null}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
