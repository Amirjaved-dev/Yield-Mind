"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, type State } from "wagmi";
import { http } from "wagmi";
import { arbitrum, avalanche, base, bsc, mainnet, optimism, polygon } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useState, useEffect, useRef, useMemo } from "react";

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
const HAS_WC = WC_PROJECT_ID !== "";

const allChains = [mainnet, arbitrum, optimism, base, polygon, avalanche, bsc] as const;

function createWagmiConfig() {
  return HAS_WC
    ? getDefaultConfig({
        appName: "YieldMind",
        projectId: WC_PROJECT_ID,
        chains: allChains,
        transports: {
          [mainnet.id]: http("https://eth.llamarpc.com"),
          [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
          [optimism.id]: http("https://mainnet.optimism.io"),
          [base.id]: http("https://mainnet.base.org"),
          [polygon.id]: http("https://polygon-rpc.com"),
          [avalanche.id]: http("https://api.avax.network/ext/bc/C/rpc"),
          [bsc.id]: http("https://bsc-dataseed.binance.org"),
        },
      })
    : createConfig({
        chains: allChains,
        transports: {
          [mainnet.id]: http("https://eth.llamarpc.com"),
          [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
          [optimism.id]: http("https://mainnet.optimism.io"),
          [base.id]: http("https://mainnet.base.org"),
          [polygon.id]: http("https://polygon-rpc.com"),
          [avalanche.id]: http("https://api.avax.network/ext/bc/C/rpc"),
          [bsc.id]: http("https://bsc-dataseed.binance.org"),
        },
        ssr: true,
      });
}

type Props = {
  children: React.ReactNode;
  initialState?: State | undefined;
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

  const config = useMemo(() => createWagmiConfig(), []);

  useEffect(() => {
    hydrateTimerRef.current = setTimeout(() => {
      setHydrated(true);
    }, 0);

    return () => {
      if (hydrateTimerRef.current) clearTimeout(hydrateTimerRef.current);
    };
  }, []);

  if (!hydrated) {
    return null;
  }

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#091615",
                border: "1px solid rgba(136, 255, 247, 0.1)",
                color: "#fff",
                fontFamily: "var(--font-geist-sans)",
                fontSize: "14px",
              },
            }}
          />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
