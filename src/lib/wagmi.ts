import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { arbitrum, avalanche, base, bsc, mainnet, optimism, polygon } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "YieldMind",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "YOUR_WALLETCONNECT_PROJECT_ID_HERE",
  chains: [mainnet, arbitrum, optimism, base, polygon, avalanche, bsc],
  ssr: true,
  transports: {
    [mainnet.id]: http("https://eth.llamarpc.com"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
    [optimism.id]: http("https://mainnet.optimism.io"),
    [base.id]: http("https://mainnet.base.org"),
    [polygon.id]: http("https://polygon-rpc.com"),
    [avalanche.id]: http("https://api.avax.network/ext/bc/C/rpc"),
    [bsc.id]: http("https://bsc-dataseed.binance.org"),
  },
});
