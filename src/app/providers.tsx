"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, type State } from "wagmi";
import { http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
const HAS_WC = WC_PROJECT_ID !== "";

const config = HAS_WC
  ? getDefaultConfig({
      appName: "YieldMind",
      projectId: WC_PROJECT_ID,
      chains: [mainnet, sepolia],
      transports: {
        [mainnet.id]: http("https://eth.drpc.org"),
        [sepolia.id]: http("https://eth-sepolia.drpc.org"),
      },
    })
  : createConfig({
      chains: [mainnet, sepolia],
      transports: {
        [mainnet.id]: http("https://eth.drpc.org"),
        [sepolia.id]: http("https://eth-sepolia.drpc.org"),
      },
      ssr: true,
    });

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
