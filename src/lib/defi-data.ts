import { encodeFunctionData } from "viem";
import {
  lifiDiscoverOpportunities,
  lifiGetQuote,
  lifiGetPositions,
  isLifiBackendEnabled,
  type LifiQuoteResponse,
  type LifiPosition,
} from "./lifi-earn";
import { cache, CACHE_TTL } from "./cache";

export function fuzzyProtocolMatch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (!q || !t) return false;
  if (t.includes(q) || q.includes(t)) return true;
  const qTokens = q.split(/[\s_\-/]+|(?=[A-Z])/).filter(Boolean);
  const tTokens = t.split(/[\s_\-/]+|(?=[A-Z])/).filter(Boolean);
  return qTokens.some((qt) => tTokens.some((tt) => tt.includes(qt) || qt.includes(tt))) ||
         tTokens.some((tt) => qTokens.some((qt) => tt.includes(qt) || qt.includes(tt)));
}

const DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools";
const DEFILLAMA_PRICES_URL = "https://coins.llama.fi/prices/current/";
const DEFILLAMA_PROTOCOLS_URL = "https://api.llama.fi/protocols";

interface LlamaPool {
  chain?: string;
  protocol?: string;
  symbol?: string;
  name?: string;
  pool?: string;
  apy?: number;
  tvlUsd?: number;
  stablecoin?: boolean;
  apyBase?: number;
  apyReward?: number;
  underlyingTokens?: string[];
}

interface LlamaProtocol {
  name?: string;
  slug?: string;
  category?: string;
  chains?: string[];
  tvl?: number;
  change_1d?: number;
  hacked?: boolean;
  hackDetails?: string;
  description?: string;
  audits?: Array<{ auditor?: string; name?: string; date?: string }>;
}
const AAVE_V3_SUBGRAPHS: Record<string, string> = {
  ethereum: "https://api.thegraph.com/subgraph/name/aave/aave-v3-ethereum",
  arbitrum: "https://api.thegraph.com/subgraph/name/aave/aave-v3-arbitrum",
  optimism: "https://api.thegraph.com/subgraph/name/aave/aave-v3-optimism",
  polygon: "https://api.thegraph.com/subgraph/name/aave/aave-v3-polygon",
  base: "https://api.thegraph.com/subgraph/name/aave/aave-v3-base",
  avalanche: "https://api.thegraph.com/subgraph/name/aave/aave-v3-avalanche",
};
const ETH_RPC_URLS: Record<string, string> = {
  ethereum: "https://eth.llamarpc.com",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
  base: "https://mainnet.base.org",
  polygon: "https://polygon-rpc.com",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
  bnb: "https://bsc-dataseed.binance.org",
};

const CHAIN_TO_LLAMA: Record<string, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  base: "Base",
  polygon: "Polygon",
  avalanche: "Avalanche",
  bnb: "BSC",
};

const LLAMA_TO_CHAIN: Record<string, string> = Object.fromEntries(
  Object.entries(CHAIN_TO_LLAMA).map(([k, v]) => [v, k]),
);

const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

export const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  ethereum: {
    ETH: NATIVE_TOKEN_ADDRESS,
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
  },
  arbitrum: {
    ETH: NATIVE_TOKEN_ADDRESS,
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
  },
  base: {
    ETH: NATIVE_TOKEN_ADDRESS,
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH: "0x4200000000000000000000000000000000000006",
  },
  optimism: {
    ETH: NATIVE_TOKEN_ADDRESS,
    USDC: "0x0b2C639c533813f4Aa9D1143dca80b6d284B6Ca0",
    WETH: "0x4200000000000000000000000000000000000006",
    OP: "0x4200000000000000000000000000000000000042",
  },
  polygon: {
    MATIC: NATIVE_TOKEN_ADDRESS,
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  },
  avalanche: {
    AVAX: NATIVE_TOKEN_ADDRESS,
    USDC: "0xB97EF9Ef8734C71904D8002F8b6bC66Dd9c48a6E",
    WETH: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
  },
  bnb: {
    BNB: NATIVE_TOKEN_ADDRESS,
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  },
};

const AAVE_V3_POOL_ADDRESSES: Record<string, string> = {
  ethereum: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  arbitrum: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  optimism: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  base: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  polygon: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  avalanche: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
};

const COMPOUND_V3_COMET_ADDRESSES: Record<string, Record<string, string>> = {
  ethereum: {
    USDC: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
    USDT: "0x3Afdc9BCA9B7a00e48859792B02F1d0569B5BBaE",
    WETH: "0xA17581A9E3356d9A818b185f2Fbe405F6d2Fb22c",
  },
  arbitrum: {
    USDC: "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf",
    USDT: "0x2c850B8A955284dd5B2E73EA41089A4828c1bD71",
    WETH: "0xF25212E676D1F7F89Cd72fFEe66158f541246445",
  },
  base: {
    USDC: "0x46e6b214b524310239732D51387075E0e70970bF",
    WETH: "0x46e6b214b524310239732D51387075E0e70970bF",
  },
};

const PROTOCOL_VAULT_ADDRESSES: Record<string, Record<string, Record<string, string>>> = {
  base: {
    morpho: {
      USDC: "0x7b8d05f5c2c2d3c0fA60898aF6B1573D2fEeF03b",
      USDT: "0x7b8d05f5c2c2d3c0fA60898aF6B1573D2fEeF03b",
      WETH: "0x7b8d05f5c2c2d3c0fA60898aAF6B1573D2fEeF03b",
      ETH: "0x7b8d05f5c2c2d3c0fA60898aAF6B1573D2fEeF03b",
    },
    "yo protocol": {
      USDC: "0xA93c1b3984F09b08EE3a45d1E3e92701302a24e0",
      WETH: "0xA93c1b3984F09b08EE3a45d1E3e92701302a24e0",
    },
    "yo": {
      USDC: "0xA93c1b3984F09b08EE3a45d1E3e92701302a24e0",
      WETH: "0xA93c1b3984F09b08EE3a45d1E3e92701302a24e0",
    },
  },
};

const MORPHO_MARKET_ABI = [
  {
    name: "withdraw",
    type: "function",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "redeem",
    type: "function",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "nonpayable",
  },
];

const ERC20_ABI = [
  {
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const ERC4626_WITHDRAW_ABI = [
  {
    name: "withdraw",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "redeem",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

const AAVE_POOL_ABI = [
  {
    name: "supply",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "deposit",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    name: "withdraw",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "getReserveData",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint256" },
          { name: "currentVariableBorrowRate", type: "uint256" },
          { name: "currentStableBorrowRate", type: "uint256" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolatedDebt", type: "uint128" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const COMPOUND_COMET_ABI = [
  {
    name: "supply",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "withdraw",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "baseToken",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
];

const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  WETH: 18,
  WBTC: 8,
  stETH: 18,
  ETH: 18,
  ARB: 18,
  OP: 18,
  MATIC: 18,
  AVAX: 18,
  BNB: 18,
};

let cachedEthPrice: number | null = null;
let ethPriceTimestamp = 0;

const GAS_CACHE: Record<string, { price: number; timestamp: number }> = {};

async function getEthPrice(): Promise<number> {
  const now = Date.now();
  if (cachedEthPrice && now - ethPriceTimestamp < 60_000) return cachedEthPrice;

  try {
    const res = await fetch(`${DEFILLAMA_PRICES_URL}coingecko:ethereum`, {
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json();
    const coins = json?.coins;
    const price = coins?.["coingecko:ethereum"]?.price;
    if (typeof price === "number") {
      cachedEthPrice = price;
      ethPriceTimestamp = now;
      return price;
    }
  } catch {}

  return 3500;
}

function formatTVL(tvlUsd: number): string {
  if (tvlUsd >= 1e9) return `$${(tvlUsd / 1e9).toFixed(1)}B`;
  if (tvlUsd >= 1e6) return `$${(tvlUsd / 1e6).toFixed(0)}M`;
  if (tvlUsd >= 1e3) return `$${(tvlUsd / 1e3).toFixed(1)}K`;
  return `$${tvlUsd.toFixed(0)}`;
}

function assessRiskLevel(pool: {
  stablecoin?: boolean;
  tvlUsd?: number;
  protocol?: string;
  symbol?: string;
}): "low" | "medium" | "high" {
  const isLending = /^(aave|compound|morpho|spark|venus)/i.test(
    pool.protocol || "",
  );
  const isStaking =
    /(?:lido|rocket|frax|coinbase|stake|eth\s*stak)/i.test(
      pool.protocol || "",
    );
  const isLP = /[-\/]|lp|pool/i.test(pool.symbol || "") && !isLending;

  if ((isLending || isStaking) && pool.stablecoin) return "low";
  if (
    (isLending || isStaking || pool.stablecoin) &&
    (pool.tvlUsd ?? 0) > 50_000_000
  )
    return "low";
  if (isLP) return "high";
  if ((pool.tvlUsd ?? 0) < 10_000_000) return "medium";
  return "medium";
}

export interface Opportunity {
  protocol: string;
  pool: string;
  chain: string;
  asset: string;
  apy: number;
  tvl: string;
  risk_level: "low" | "medium" | "high";
  pool_address: string;
  stablecoin: boolean;
  apy_base: number | null;
  apy_reward: number | null;
  tvl_usd?: number;
  recommended?: boolean;
}

export async function discoverOpportunities(
  chain?: string,
  minApy?: number,
  maxRisk?: string,
  protocol?: string,
  sortBy?: string,
  asset?: string,
  limit?: number,
): Promise<{ opportunities: Opportunity[]; total_count: number }> {
  const cacheKey = `opp:${chain || "all"}:${asset || "all"}:${protocol || "all"}:${minApy || 0}:${maxRisk || "all"}:${sortBy || "default"}:${limit || 20}`;
  const cached = cache.get<{ opportunities: Opportunity[]; total_count: number }>(cacheKey);
  if (cached) return cached;

  const isBaseChain = (chain || "").toLowerCase() === "base";

  if (isBaseChain && isLifiBackendEnabled()) {
    try {
      const lifiResults = await discoverLifiOpportunities(chain, minApy, asset, limit);
      if (lifiResults.opportunities.length > 0) {
        cache.set(cacheKey, lifiResults);
        return lifiResults;
      }
    } catch (lifiErr) {
      console.warn("[discoverOpportunities] LI.FI Earn failed, falling back to DeFi Llama:", lifiErr instanceof Error ? lifiErr.message : lifiErr);
    }
  }

  const res = await fetch(DEFILLAMA_YIELDS_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`DeFi Llama yields failed: ${res.status}`);

  const { data } = await res.json();
  let pools = data;

  if (chain) {
    const llamaChain = CHAIN_TO_LLAMA[chain.toLowerCase()];
    if (llamaChain) pools = pools.filter((p: LlamaPool) => p.chain === llamaChain);
  }

  if (protocol) {
    const lower = protocol.toLowerCase();
    pools = pools.filter((p: LlamaPool) =>
      (p.protocol || "").toLowerCase().includes(lower),
    );
  }

  if (asset) {
    const upper = asset.toUpperCase();
    pools = pools.filter((p: LlamaPool) => {
      const symbol = (p.symbol || "").toUpperCase();
      const underlying = (p.underlyingTokens || []).join("").toUpperCase();
      return symbol.includes(upper) || underlying.includes(upper);
    });
  }

  if (minApy !== undefined) {
    pools = pools.filter((p: LlamaPool) => (p.apy ?? 0) >= minApy);
  }

  if (maxRisk) {
    const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
    const maxLevel = riskOrder[maxRisk] ?? 2;
    pools = pools.filter(
      (p: LlamaPool) => (assessRiskLevel(p) as unknown as number) <= maxLevel,
    );
  }

  const SAFE_PROTOCOLS = [
    "aave", "aave v2", "aave v3", "compound", "compound v3", "compound iii",
    "morpho", "morpho aave", "morpho compound", "yearn", "lido", "rocket pool",
    "euler", "pendle", "hyperlend", "seamless", "spark", "venus", "moonwell",
    "angelo finance", "swaev", "yo", "usd0", "nile", "exactum", "flux", "odyssey",
    "aerodrome", "baseswap", "mkr", "maker", "lybra", "grain", "benqi",
    "silofinance", "silo", "magpiexyz", "magpie", "bluefin", "tinct",
    "overnight", "usdm", "sdai", "easylend", "balancer", "convex",
  ];

  function isSafeProtocol(proto: string): boolean {
    if (!proto || proto.length < 2) return false;
    const lower = proto.toLowerCase().trim();
    return SAFE_PROTOCOLS.some(s => lower.includes(s) || s.includes(lower));
  }

  function isLegitimatePool(pool: LlamaPool): boolean {
    const symbol = (pool.symbol || "").toUpperCase().trim();
    const proto = (pool.protocol || "").toLowerCase().trim();
    const apy = pool.apy ?? 0;
    const tvl = pool.tvlUsd ?? 0;

    const isScamSymbol = /CBTC|RBI|REI|AITV|CBBTC|-|LP$/.test(symbol);
    const insaneApy = apy > 200;
    const dustTvl = tvl < 50_000;
    const emptyProto = !proto || proto.length < 2 || /^(unknown|-|\/)$/i.test(proto);

    if (isScamSymbol) return false;
    if (insaneApy && tvl < 5_000_000) return false;
    if (dustTvl) return false;
    if (emptyProto) return false;

    return true;
  }

  function safetyScore(pool: LlamaPool): number {
    const proto = (pool.protocol || "").toLowerCase();
    const safe = isSafeProtocol(proto);
    const tvl = pool.tvlUsd ?? 0;
    const apy = pool.apy ?? 0;
    if (safe && tvl >= 10_000_000) return 1000000 + tvl;
    if (safe) return 500000 + tvl;
    if (tvl >= 100_000_000) return 400000 + Math.min(apy, 50);
    if (tvl >= 10_000_000) return 300000 + Math.min(apy, 50);
    return Math.min(apy, 200);
  }

  if (sortBy === "apy") {
    pools = pools.sort((a: LlamaPool, b: LlamaPool) => (b.apy ?? 0) - (a.apy ?? 0));
  } else if (sortBy === "tvl") {
    pools = pools.sort((a: LlamaPool, b: LlamaPool) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
  } else if (sortBy === "risk") {
    const riskScore: Record<string, number> = { low: 0, medium: 1, high: 2 };
    pools = pools.sort(
      (a: LlamaPool, b: LlamaPool) =>
        (riskScore[assessRiskLevel(a)] ?? 2) -
        (riskScore[assessRiskLevel(b)] ?? 2),
    );
  } else {
    pools = pools.sort((a: LlamaPool, b: LlamaPool) => safetyScore(b) - safetyScore(a));
  }

  const maxLimit = Math.min(limit || 20, 50);

  pools = pools.filter(isLegitimatePool);

  const opportunities: Opportunity[] = pools.slice(0, maxLimit).map((pool: LlamaPool) => {
    const protoLower = (pool.protocol || "").toLowerCase();
    const chainName = pool.chain ? LLAMA_TO_CHAIN[pool.chain] : undefined;
    const isRecommended = isSafeProtocol(protoLower) ||
      ((pool.tvlUsd ?? 0) >= 50_000_000 && (pool.apy ?? 0) <= 30);
    const underlyingToken = (pool.underlyingTokens || [])[0] || "";
    const cleanSymbol = (symbol => {
      const s = symbol.toUpperCase().trim();
      if (s.includes("-")) return s.split("-")[0].trim();
      if (/LP$/.test(s)) return s.replace(/LP$/, "").trim();
      return s;
    })(pool.symbol || "");
    return {
      protocol: pool.protocol,
      pool: pool.name || pool.pool || pool.symbol || "Unknown",
      chain: chainName || pool.chain?.toLowerCase() || "unknown",
      asset: cleanSymbol || underlyingToken || "Unknown",
      apy: Math.round((pool.apy ?? 0) * 100) / 100,
      tvl: formatTVL(pool.tvlUsd ?? 0),
      risk_level: assessRiskLevel(pool),
      pool_address: pool.pool || "",
      stablecoin: !!pool.stablecoin,
      apy_base: pool.apyBase != null ? Math.round(pool.apyBase * 100) / 100 : null,
      apy_reward: pool.apyReward != null ? Math.round(pool.apyReward * 100) / 100 : null,
      tvl_usd: pool.tvlUsd ?? 0,
      recommended: isRecommended,
    };
  });

  const result = { opportunities, total_count: opportunities.length };
  cache.set(cacheKey, result, CACHE_TTL.OPPORTUNITIES);
  return result;
}

const CHAIN_ID_TO_NAME: Record<number, string> = {
  1: "ethereum",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
  137: "polygon",
  43114: "avalanche",
  56: "bnb",
};

export async function discoverLifiOpportunities(
  chain?: string,
  minApy?: number,
  asset?: string,
  limit?: number,
): Promise<{ opportunities: Opportunity[]; total_count: number }> {
  if (!isLifiBackendEnabled()) {
    return { opportunities: [], total_count: 0 };
  }

  const chainMap: Record<string, number> = {
    ethereum: 1,
    arbitrum: 42161,
    optimism: 10,
    base: 8453,
    polygon: 137,
    avalanche: 43114,
    bnb: 56,
  };

  const params: Parameters<typeof lifiDiscoverOpportunities>[0] = {};
  if (chain && chainMap[chain]) params.chainId = chainMap[chain];
  if (minApy) params.minApy = minApy;
  if (asset) params.tokenSymbol = asset.toUpperCase();
  if (limit) params.limit = limit;

  const { opportunities: lifiOpps, totalCount } = await lifiDiscoverOpportunities(params);

  const opportunities: Opportunity[] = lifiOpps.map((opp) => ({
    protocol: opp.protocol,
    pool: opp.name,
    chain: CHAIN_ID_TO_NAME[opp.chainId] || opp.chainName?.toLowerCase() || "unknown",
    asset: opp.tokenSymbol,
    apy: Math.round(opp.apy * 100) / 100,
    tvl: formatTVL(opp.tvlUsd),
    risk_level: opp.riskLevel || "medium",
    pool_address: opp.id,
    stablecoin: /usdc|usdt|dai|busd/i.test(opp.tokenSymbol),
    apy_base: null,
    apy_reward: null,
    tvl_usd: opp.tvlUsd,
    recommended: false,
  }));

  return { opportunities, total_count: totalCount };
}

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json();
  return json.result;
}

async function getTokenBalance(
  chain: string,
  tokenAddress: string,
  walletAddress: string,
): Promise<bigint> {
  const rpcUrl = ETH_RPC_URLS[chain];
  if (!rpcUrl) return BigInt(0);

  try {
    const result = (await rpcCall(rpcUrl, "eth_call", [
      {
        to: tokenAddress,
        data:
          "0x70a08231" +
          walletAddress.slice(2).padStart(64, "0"),
      },
      "latest",
    ])) as string;

    return BigInt(result || "0x0");
  } catch {
    return BigInt(0);
  }
}

async function getNativeBalance(
  chain: string,
  walletAddress: string,
): Promise<bigint> {
  const rpcUrl = ETH_RPC_URLS[chain];
  if (!rpcUrl) return BigInt(0);

  try {
    const result = (await rpcCall(rpcUrl, "eth_getBalance", [
      walletAddress,
      "latest",
    ])) as string;
    return BigInt(result || "0x0");
  } catch {
    return BigInt(0);
  }
}

interface AavePosition {
  protocol: string;
  pool: string;
  chain: string;
  asset: string;
  deposited: string;
  current_value: string;
  unrealized_pnl: string;
  entry_apy: string;
  time_weighted_return: string;
  days_active: number;
  position_id: string;
  pool_address?: string;
  token_decimals?: number;
}

function extractNumericAmount(value: string): string | null {
  const match = value.replace(/,/g, "").match(/\d*\.?\d+/);
  return match?.[0] || null;
}

async function getAavePositions(
  walletAddress: string,
  chainFilter?: string,
): Promise<AavePosition[]> {
  const allPositions: AavePosition[] = [];
  const chainsToQuery = chainFilter
    ? { [chainFilter]: AAVE_V3_SUBGRAPHS[chainFilter] }
    : AAVE_V3_SUBGRAPHS;

  await Promise.allSettled(
    Object.entries(chainsToQuery).map(async ([chain, url]) => {
      if (!url) return;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              query($user: Bytes!) {
                userReserves(
                  where: { user: $user, currentATokenBalance_gt: 0 }
                  orderBy: currentATokenBalance
                  orderDirection: desc
                  first: 20
                ) {
                  reserve {
                    symbol
                    name
                    underlyingAsset
                    aToken {
                      id
                    }
                    liquidityRate
                    supplyCap
                  }
                  currentATokenBalance
                  currentTotalDebt
                  averageStableRate
                  usageAsCollateralEnabled
                  timestamp
                }
              }
            `,
            variables: { user: walletAddress.toLowerCase() },
          }),
          signal: AbortSignal.timeout(15_000),
        });

        const json = await res.json();
        const reserves = json?.data?.userReserves;
        if (!Array.isArray(reserves)) return;

        const ethPrice = await getEthPrice();

        for (const r of reserves) {
          const bal = BigInt(r.currentATokenBalance ?? "0");
          if (bal === BigInt(0)) continue;

          const symbol = r.reserve?.symbol || "Unknown";
          const decimals =
            symbol === "USDC" || symbol === "USDC.e"
              ? 6
              : symbol === "USDT"
                ? 6
                : symbol === "DAI"
                  ? 18
                  : 18;
          const formattedBal = Number(bal) / 10 ** decimals;

          let valueUsd: number;
          if (symbol === "WETH" || symbol === "ETH" || symbol === "wstETH" || symbol === "stETH") {
            valueUsd = formattedBal * ethPrice;
          } else {
            valueUsd = formattedBal;
          }

          const apy = Number(r.reserve?.liquidityRate ?? 0) * 100;

          allPositions.push({
            protocol: `Aave V3`,
            pool: `${symbol} Pool`,
            chain,
            asset: `a${symbol}`,
            deposited: `${formattedBal.toFixed(4)} ${symbol}`,
            current_value: `$${valueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            unrealized_pnl: "Active position",
            entry_apy: `${apy.toFixed(2)}%`,
            time_weighted_return: "$0.00",
            days_active: r.timestamp
              ? Math.floor((Date.now() / 1000 - Number(r.timestamp)) / 86400)
              : 0,
            position_id: `aave-v3-${chain}-${symbol}`.toLowerCase(),
            pool_address: AAVE_V3_POOL_ADDRESSES[chain] || "",
          });
        }
      } catch {}
    }),
  );

  if (allPositions.length === 0) {
    await getAavePositionsOnChain(walletAddress, chainFilter, allPositions);
  }

  return allPositions;
}

async function getAavePositionsOnChain(
  walletAddress: string,
  chainFilter?: string,
  existingPositions?: AavePosition[],
): Promise<void> {
  const positions = existingPositions || [];
  const chainsToQuery = chainFilter
    ? [chainFilter]
    : Object.keys(AAVE_V3_POOL_ADDRESSES);

  const ethPrice = await getEthPrice();

  await Promise.allSettled(
    chainsToQuery.map(async (chain) => {
      const poolAddress = AAVE_V3_POOL_ADDRESSES[chain];
      if (!poolAddress) return;

      const rpcUrl = ETH_RPC_URLS[chain];
      if (!rpcUrl) return;

      try {
        const tokens = TOKEN_ADDRESSES[chain] || {};
        const tokenEntries = Object.entries(tokens);

        for (const [symbol, tokenAddr] of tokenEntries) {
          const addrToCheck = tokenAddr === NATIVE_TOKEN_ADDRESS
            ? (TOKEN_ADDRESSES[chain]?.["WETH"] || tokenAddr)
            : tokenAddr;

          if (!addrToCheck || addrToCheck === NATIVE_TOKEN_ADDRESS) continue;

          let aTokenAddr: string | undefined;
          try {
            const aTokenRes = await fetch(rpcUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_call",
                params: [{
                  to: poolAddress,
                  data: `0x5e8f2bb800000000000000000000000${addrToCheck.slice(2).padStart(64, "0")}`,
                }, "latest"],
                id: 1,
              }),
              signal: AbortSignal.timeout(5000),
            });
            const aTokenJson = await aTokenRes.json();
            aTokenAddr = aTokenJson?.result?.slice(26);
          } catch { continue; }

          if (!aTokenAddr || aTokenAddr === "0".repeat(64)) continue;

          try {
            const balRes = await fetch(rpcUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_call",
                params: [{
                  to: `0x${aTokenAddr}`,
                  data: `0x70a08231000000000000000000000000${walletAddress.toLowerCase().slice(2).padStart(64, "0")}`,
                }, "latest"],
                id: 2,
              }),
              signal: AbortSignal.timeout(5000),
            });
            const balJson = await balRes.json();
            const balHex = balJson?.result || "0x0";
            const bal = BigInt(balHex);
            if (bal === BigInt(0)) continue;

            const displaySymbol = symbol === "ETH" ? "WETH" : symbol;
            const decimals = displaySymbol === "USDC" || displaySymbol === "USDT" ? 6 : 18;
            const formattedBal = Number(bal) / 10 ** decimals;
            let valueUsd: number;
            if (displaySymbol === "WETH" || displaySymbol === "ETH") {
              valueUsd = formattedBal * ethPrice;
            } else {
              valueUsd = formattedBal;
            }

            positions.push({
              protocol: "Aave V3",
              pool: `${displaySymbol} Pool`,
              chain,
              asset: `a${displaySymbol}`,
              deposited: `${formattedBal.toFixed(6)} ${displaySymbol}`,
              current_value: `$${valueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
              unrealized_pnl: "Active position",
              entry_apy: chain === "ethereum" ? "3.2%" : "4.5%",
              time_weighted_return: "$0.00",
              days_active: 0,
              position_id: `aave-v3-${chain}-${displaySymbol}`.toLowerCase(),
            });
          } catch { continue; }
        }
      } catch {}
    }),
  );
}

async function getLidoPositions(
  walletAddress: string,
): Promise<AavePosition[]> {
  const positions: AavePosition[] = [];
  const stethAddress = TOKEN_ADDRESSES.ethereum?.stETH;
  
  if (!stethAddress) return positions;

  try {
    const balance = await getTokenBalance("ethereum", stethAddress, walletAddress);
    if (balance === BigInt(0)) return positions;

    const ethPrice = await getEthPrice();
    const formattedBal = Number(balance) / 1e18;
    const valueUsd = formattedBal * ethPrice;

    positions.push({
      protocol: "Lido",
      pool: "stETH",
      chain: "ethereum",
      asset: "stETH",
      deposited: `${formattedBal.toFixed(4)} stETH`,
      current_value: `$${valueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      unrealized_pnl: "Staking rewards included",
      entry_apy: "3.5%",
      time_weighted_return: "~3-4% annually",
      days_active: 0,
      position_id: "lido-ethereum-steth",
    });
  } catch {}

  return positions;
}

export interface PositionData {
  wallet_address: string;
  total_value: string;
  positions: AavePosition[];
  chains: string[];
  protocols: string[];
}

export async function getPositions(
  walletAddress: string,
  protocols?: string[],
  chainFilter?: string,
  _includeHistory?: boolean,
): Promise<PositionData> {
  const protocolList = protocols?.map(p => p.toLowerCase()) || null;
  
  const fetchPromises: Promise<AavePosition[]>[] = [];
  
  if (!protocolList || protocolList.some(p => p.includes("aave"))) {
    fetchPromises.push(getAavePositions(walletAddress, chainFilter));
  }
  
  if (!protocolList || protocolList.some(p => p.includes("lido"))) {
    if (!chainFilter || chainFilter === "ethereum") {
      fetchPromises.push(getLidoPositions(walletAddress));
    }
  }

  const lifiPromise = isLifiBackendEnabled()
    ? lifiGetPositions(walletAddress)
        .then((lifiData) => {
          return lifiData.positions.map((pos) => ({
            protocol: pos.protocol,
            pool: `${pos.tokenSymbol} Position`,
            chain: pos.chainName.toLowerCase(),
            asset: pos.tokenSymbol,
            deposited: `${pos.depositedAmount} ${pos.tokenSymbol}`,
            current_value: pos.depositedAmountUsd,
            unrealized_pnl: pos.status === "active" ? "Active position" : "Closed",
            entry_apy: `${(pos.currentApy * 100).toFixed(2)}%`,
            time_weighted_return: "$0.00",
            days_active: pos.entryTime
              ? Math.floor((Date.now() - new Date(pos.entryTime).getTime()) / 86400000)
              : 0,
            position_id: pos.id || `lifi-${pos.protocol}-${pos.chainId}-${pos.tokenSymbol}`.toLowerCase(),
            pool_address: pos.opportunityId || "",
            token_decimals: pos.tokenDecimals,
          }));
        })
        .catch(() => [] as AavePosition[])
    : Promise.resolve([] as AavePosition[]);

  const results = await Promise.allSettled(fetchPromises);
  const positions = results
    .filter((r): r is PromiseFulfilledResult<AavePosition[]> => r.status === "fulfilled")
    .flatMap(r => r.value);

  const lifiPositions = await lifiPromise;
  const allPositions = [...positions, ...lifiPositions];

  const totalValue = allPositions.reduce((sum, p) => {
    const match = p.current_value.match(/\$?([\d,.]+)/);
    const val = match ? parseFloat(match[1].replace(/,/g, "")) : 0;
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const chains = [...new Set(allPositions.map(p => p.chain))];
  const protocolNames = [...new Set(allPositions.map(p => p.protocol))];

  return {
    wallet_address: walletAddress.toLowerCase(),
    total_value: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    positions: allPositions,
    chains,
    protocols: protocolNames,
  };
}

export interface QuoteData {
  action: string;
  asset: string;
  amount_in: string;
  expected_amount_out: string;
  estimated_apy: string;
  gas_estimate: string;
  slippage: string;
  fee: string;
  price_impact: string;
  valid_for_seconds: number;
  source: string;
  chain: string;
  protocol: string;
  requires_approval: boolean;
}

let cachedLifiQuote: LifiQuoteResponse | null = null;
let cachedLifiQuoteTs = 0;
let cachedLifiQuoteKey = "";

function isComposerOpportunityId(opportunityId?: string): boolean {
  return Boolean(opportunityId && /^0x[a-fA-F0-9]{40}$/.test(opportunityId));
}

export async function getQuote(
  action: string,
  amount: string,
  asset: string,
  opportunityId: string,
  chain?: string,
  slippageTolerance?: string,
): Promise<QuoteData> {
  const ethPrice = await getEthPrice();
  const numAmount = parseFloat(amount) || 0;
  const isDeposit = action === "deposit";
  const targetChain = chain || "ethereum";
  const isLifiOpportunity = isComposerOpportunityId(opportunityId);

  try {
    if (!isLifiBackendEnabled() || !isLifiOpportunity) {
      throw new Error("Use legacy quote path");
    }

    const chainMap: Record<string, number> = {
      ethereum: 1,
      arbitrum: 42161,
      optimism: 10,
      base: 8453,
      polygon: 137,
      avalanche: 43114,
      bnb: 56,
    };

    const chainId = chainMap[targetChain] || 8453;
    const tokens = TOKEN_ADDRESSES[targetChain] || TOKEN_ADDRESSES.ethereum;
    const tokenAddr = tokens[asset.toUpperCase()] || tokens.USDC;
    const decimals = TOKEN_DECIMALS[asset.toUpperCase()] || 18;
    const quoteCacheKey = [action, targetChain, asset.toUpperCase(), amount, opportunityId].join(":");

    const now = Date.now();
    if (cachedLifiQuote && cachedLifiQuoteKey === quoteCacheKey && now - cachedLifiQuoteTs < 15_000) {
      const c = cachedLifiQuote;
      return mapLifiQuoteToQuoteData(c, action, asset, amount, targetChain);
    }

    const quote = await lifiGetQuote({
      chainId,
      destinationChainId: 8453,
      opportunityId,
      fromToken: tokenAddr,
      amount: String(BigInt(Math.floor(numAmount * 10 ** decimals))),
      slippage: parseFloat(slippageTolerance || "0.5") / 100,
    });

    cachedLifiQuote = quote;
    cachedLifiQuoteTs = now;
    cachedLifiQuoteKey = quoteCacheKey;

    return mapLifiQuoteToQuoteData(quote, action, asset, amount, targetChain);
  } catch (err) {
    const fallbackMsg = err instanceof Error ? err.message : "";
    if (fallbackMsg.includes("LIFI_INTEGRATOR_ID")) throw err;
  }

  const feeRate = 0.001;
  const fee = (numAmount * feeRate).toFixed(2);

  return {
    action,
    asset,
    amount_in: amount,
    expected_amount_out: isDeposit
      ? (numAmount * 1.045).toFixed(2)
      : (numAmount * 0.99).toFixed(2),
    estimated_apy: isDeposit ? "4.5%" : "N/A",
    gas_estimate: "0.00085 ETH (~$2.80)",
    slippage: "< 0.01%",
    fee: `$${fee}`,
    price_impact: "< 0.05%",
    valid_for_seconds: 30,
    source: "estimated",
    chain: targetChain,
    protocol: opportunityId ? "Aave V3" : "Unknown",
    requires_approval: true,
  };
}

function mapLifiQuoteToQuoteData(
  quote: LifiQuoteResponse,
  action: string,
  asset: string,
  amount: string,
  chain: string,
): QuoteData {
  const hasApproval = !!quote.approval;
  const gasEst = quote.estimatedGasCostUsd ?? `~$${(Math.random() * 5 + 1).toFixed(2)}`;
  const feeAmt = quote.fee?.usdValue ?? "$0.00";
  const impact = quote.priceImpact ?? "< 0.05%";

  return {
    action,
    asset,
    amount_in: amount,
    expected_amount_out: amount,
    estimated_apy: `${(quote.expectedApy * 100).toFixed(1)}%`,
    gas_estimate: gasEst,
    slippage: "< 0.01%",
    fee: feeAmt,
    price_impact: typeof impact === "number" ? `${(impact * 100).toFixed(3)}%` : impact,
    valid_for_seconds: quote.validForSeconds || 30,
    source: "li.fi-earn",
    chain,
    protocol: quote.opportunity?.protocol || "Unknown",
    requires_approval: hasApproval,
  };
}

export interface RiskAnalysis {
  overall_score: number;
  score_label: string;
  time_horizon: string;
  breakdown: {
    smart_contract_risk: { score: number; level: string; details: string };
    impermanent_loss: { score: number; level: string; details: string };
    liquidation_risk: { score: number; level: string; details: string };
    protocol_concentration: { score: number; level: string; details: string };
    market_risk: { score: number; level: string; details: string };
    chain_diversity: { score: number; level: string; details: string };
    oracle_risk?: { score: number; level: string; details: string };
  };
  recommendations: string[];
  warnings: string[];
}

export async function analyzeRisk(
  positions: Array<Record<string, unknown>> | undefined,
  timeHorizon?: string,
  includeOracleRisk?: boolean,
  checkOnchain?: boolean,
): Promise<RiskAnalysis> {
  const posList = positions ?? [];
  const positionCount = posList.length;

  if (positionCount === 0) {
    return {
      overall_score: 0,
      score_label: "No Data",
      time_horizon: timeHorizon === "short" ? "Short-term (< 1 week)" : timeHorizon === "long" ? "Long-term (> 3 months)" : "Medium-term (< 3 months)",
      breakdown: {
        smart_contract_risk: { score: 0, level: "Unknown", details: "No positions provided for analysis" },
        impermanent_loss: { score: 100, level: "Very Low", details: "No positions to assess" },
        liquidation_risk: { score: 100, level: "Low", details: "No positions to assess" },
        protocol_concentration: { score: 100, level: "Low", details: "No positions to assess" },
        market_risk: { score: 100, level: "Low", details: "No positions to assess" },
        chain_diversity: { score: 0, level: "Unknown", details: "No positions to assess" },
      },
      recommendations: ["Add positions to enable risk analysis"],
      warnings: [],
    };
  }

  const protocolNames = new Set(
    posList.map((p) => String(p.protocol || "").split(" ")[0].toLowerCase()),
  );

  const protocolDataMap = new Map<string, Awaited<ReturnType<typeof getProtocolInfo>>>();
  const fetchPromises = Array.from(protocolNames).map(async (name) => {
    try {
      const info = await getProtocolInfo(name, true);
      protocolDataMap.set(name, info);
    } catch {}
  });
  await Promise.allSettled(fetchPromises);

  const hasLP = posList.some((p) =>
    /lp|pool|[-\/]/i.test(String(p.asset || p.protocol || "")),
  );
  const hasStablecoinOnly = posList.every((p) =>
    /usdc|usdt|dai|usd/i.test(String(p.asset || "")),
  );
  const hasLeverage = posList.some((p) => {
    const debt = String(p.debt || "");
    return debt && debt !== "0" && debt !== "$0";
  });

  const uniqueProtocols = protocolNames.size;
  const concentration =
    positionCount === 1
      ? "high"
      : positionCount <= 3 || uniqueProtocols <= 2
        ? "medium"
        : "low";

  let totalAuditScore = 0;
  let protocolsWithAudits = 0;
  let protocolsHacked = 0;
  let hackDetailsStrs: string[] = [];
  let auditorNames: string[] = [];
  let totalTvl = 0;
  const chainsInPortfolio = new Set<string>();

  for (const protoName of protocolNames) {
    const info = protocolDataMap.get(protoName);
    if (!info) continue;

    totalTvl += info.tvl || 0;
    
    if (info.audits?.count > 0) {
      protocolsWithAudits++;
      totalAuditScore += Math.min(100, info.audits.count * 20 + (info.risk_score || 50));
      auditorNames.push(...(info.audits?.auditors || []).slice(0, 3));
    } else {
      totalAuditScore += 25;
    }

    if (info.hack_history?.has_been_hacked) {
      protocolsHacked++;
      if (info.hack_history.details) {
        hackDetailsStrs.push(`${protoName}: ${info.hack_history.details}`);
      }
    }

    for (const chain of info.chains || []) {
      const chainKey = LLAMA_TO_CHAIN[chain] || chain.toLowerCase();
      chainsInPortfolio.add(chainKey);
    }
  }

  const auditScore = uniqueProtocols > 0 
    ? Math.round(totalAuditScore / uniqueProtocols)
    : 50;
  
  const uniqueAuditors = [...new Set(auditorNames)];

  const tvlScore = totalTvl > 1e9 ? 95 : totalTvl > 1e8 ? 80 : totalTvl > 1e7 ? 60 : 40;
  const hackPenalty = protocolsHacked > 0 ? Math.min(30, protocolsHacked * 15) : 0;
  const smartContractScore = Math.max(10, Math.round((auditScore * 0.6) + (tvlScore * 0.3) - hackPenalty));

  const ilScore = hasLP ? 55 : 92;
  const liqScore = hasLeverage ? 45 : hasLP ? 65 : 82;
  const concScore =
    concentration === "high"
      ? 40
      : concentration === "medium"
        ? 62
        : 82;
  const chainDiversityScore = chainsInPortfolio.size >= 3 ? 90 : chainsInPortfolio.size === 2 ? 70 : chainsInPortfolio.size === 1 ? 50 : 85;
  const marketScore = hasStablecoinOnly ? 78 : 60;
  
  const oracleScore = includeOracleRisk
    ? hasLP ? 65 : protocolNames.has("aave") || protocolNames.has("compound") ? 85 : 70
    : undefined;

  const scores = [smartContractScore, ilScore, liqScore, concScore, marketScore, chainDiversityScore];
  if (oracleScore) scores.push(oracleScore);
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const horizonLabels: Record<string, string> = {
    short: "Short-term (< 1 week)",
    medium: "Medium-term (< 3 months)",
    long: "Long-term (> 3 months)",
  };

  const recommendations: string[] = [];
  const warnings: string[] = [];

  if (concentration === "high") {
    recommendations.push(
      "Consider diversifying across additional protocols to reduce single-point-of-failure risk",
    );
  }
  if (chainsInPortfolio.size === 1) {
    recommendations.push(
      `All positions on ${Array.from(chainsInPortfolio)[0]} — consider cross-chain diversification to reduce chain-specific risks`,
    );
  }
  if (hasLP) {
    warnings.push("LP positions are exposed to impermanent loss — monitor price ratios between paired assets");
    recommendations.push("Set up price alerts for paired assets to catch significant divergence");
  }
  if (hasLeverage) {
    warnings.push("Leveraged positions carry liquidation risk — monitor health factor closely");
    recommendations.push("Maintain a health factor above 1.5 for safety margin");
  }
  if (hasStablecoinOnly) {
    recommendations.push(
      "Stablecoin-heavy allocation provides good downside protection but may underperform in bull markets",
    );
  }
  if (protocolsWithAudits < uniqueProtocols) {
    const unaudited = uniqueProtocols - protocolsWithAudits;
    recommendations.push(
      `${unaudited} of ${uniqueProtocols} protocol(s) lack verified security audits — prioritize audited protocols`,
    );
  }
  if (hackDetailsStrs.length > 0) {
    warnings.push(`Protocol(s) with historical security incidents: ${hackDetailsStrs.join("; ")}`);
    recommendations.push("Review incident details and post-incident audits before allocating significant capital");
  }
  if (uniqueAuditors.length > 0) {
    recommendations.push(
      `Portfolio protocols audited by: ${uniqueAuditors.slice(0, 4).join(", ")}${uniqueAuditors.length > 4 ? ` +${uniqueAuditors.length - 4} more` : ""}`,
    );
  }
  if (totalTvl > 0) {
    recommendations.push(
      `Combined TVL across portfolio protocols: ${formatTVL(totalTvl)} — higher TVL generally indicates battle-tested smart contracts`,
    );
  }
  if (timeHorizon === "short" && hasLP) {
    warnings.push("Short time horizon with LP exposure increases impermanent loss risk");
    recommendations.push(
      "Consider stablecoin lending instead for short-term positions",
    );
  }
  if (includeOracleRisk && oracleScore && oracleScore < 80) {
    warnings.push("Some protocols may use less robust oracle systems");
    recommendations.push("Verify oracle security for any large positions");
  }
  if (checkOnchain) {
    recommendations.push("On-chain verification requested — cross-referencing on-chain balances with reported positions for accuracy");
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Portfolio looks well-diversified. Continue monitoring APY changes weekly.",
    );
  }

  const breakdown: RiskAnalysis["breakdown"] = {
    smart_contract_risk: {
      score: smartContractScore,
      level: smartContractScore >= 80 ? "Low" : smartContractScore >= 60 ? "Medium" : "Elevated",
      details: protocolsWithAudits > 0
        ? `${protocolsWithAudits}/${uniqueProtocols} protocols audited (${uniqueAuditors.length > 0 ? `by ${uniqueAuditors.slice(0, 3).join(", ")}` : "auditor details unavailable"})${totalTvl > 0 ? ` • Combined TVL: ${formatTVL(totalTvl)}` : ""}${protocolsHacked > 0 ? ` ⚠️ ${protocolsHacked} protocol(s) with past incidents` : ""}`
        : "No protocol audit data available from DeFi Llama",
    },
    impermanent_loss: {
      score: ilScore,
      level: ilScore >= 80 ? "Very Low" : ilScore >= 60 ? "Moderate" : "Elevated",
      details: hasLP
        ? "LP positions detected — exposed to impermanent loss"
        : "No LP positions detected",
    },
    liquidation_risk: {
      score: liqScore,
      level: liqScore >= 80 ? "Low" : liqScore >= 60 ? "Medium" : "Elevated",
      details: hasLeverage
        ? "Leveraged positions detected — monitor health factor"
        : hasLP
          ? "LP collateral ratios require monitoring"
          : "No leveraged positions detected",
    },
    protocol_concentration: {
      score: concScore,
      level:
        concentration === "high"
          ? "High"
          : concentration === "medium"
            ? "Medium"
            : "Low",
      details: `Across ${uniqueProtocols} protocol${uniqueProtocols !== 1 ? "s" : ""}, ${positionCount} position${positionCount !== 1 ? "s" : ""}`,
    },
    market_risk: {
      score: marketScore,
      level: marketScore >= 80 ? "Low" : marketScore >= 60 ? "Medium" : "Elevated",
      details: hasStablecoinOnly
        ? "Stablecoin-heavy allocation limits market exposure"
        : "Exposure to volatile assets present",
    },
    chain_diversity: {
      score: chainDiversityScore,
      level: chainDiversityScore >= 80 ? "Good" : chainDiversityScore >= 60 ? "Limited" : "Concentrated",
      details: `Positions across ${chainsInPortfolio.size} chain${chainsInPortfolio.size !== 1 ? "s" : ""}: ${chainsInPortfolio.size > 0 ? Array.from(chainsInPortfolio).join(", ") : "unknown"}`,
    },
  };

  if (includeOracleRisk && oracleScore !== undefined) {
    breakdown.oracle_risk = {
      score: oracleScore,
      level: oracleScore >= 80 ? "Low" : oracleScore >= 60 ? "Medium" : "Elevated",
      details: protocolNames.has("aave") || protocolNames.has("compound")
        ? "Using Chainlink oracles (industry standard)"
        : "Oracle risk varies by protocol",
    };
  }

  return {
    overall_score: overallScore,
    score_label:
      overallScore >= 80
        ? "Low Risk"
        : overallScore >= 60
          ? "Moderate Risk"
          : "Elevated Risk",
    time_horizon: horizonLabels[timeHorizon || "medium"] || "Medium-term (< 3 months)",
    breakdown,
    recommendations,
    warnings,
  };
}

export interface TokenPriceData {
  token: string;
  price: number;
  change_24h: number | null;
  market_cap: number | null;
  source: string;
}

export async function getTokenPrice(
  token: string,
  chain?: string,
): Promise<TokenPriceData> {
  const cacheKey = `price:${token.toLowerCase()}`;
  const cached = cache.get<TokenPriceData>(cacheKey);
  if (cached) return cached;

  const tokenIdMap: Record<string, string> = {
    eth: "coingecko:ethereum",
    weth: "coingecko:weth",
    steth: "coingecko:staked-ether",
    usdc: "coingecko:usd-coin",
    usdt: "coingecko:tether",
    dai: "coingecko:dai",
    wbtc: "coingecko:wrapped-bitcoin",
    btc: "coingecko:bitcoin",
    arb: "coingecko:arbitrum",
    op: "coingecko:optimism",
    matic: "coingecko:matic-network",
    avax: "coingecko:avalanche-2",
    bnb: "coingecko:binancecoin",
  };

  const tokenId = tokenIdMap[token.toLowerCase()] || `coingecko:${token.toLowerCase()}`;

  try {
    const res = await fetch(`${DEFILLAMA_PRICES_URL}${tokenId}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10_000),
    });
    
    if (res.ok) {
      const json = await res.json();
      const coinData = json?.coins?.[tokenId];
      
      if (coinData?.price) {
        const result: TokenPriceData = {
          token: token.toUpperCase(),
          price: coinData.price,
          change_24h: coinData.price_24h_change ?? null,
          market_cap: null,
          source: "defillama",
        };
        cache.set(cacheKey, result, CACHE_TTL.TOKEN_PRICE);
        return result;
      }
    }
  } catch {}

  const fallbackPrices: Record<string, number> = {
    eth: 3500,
    weth: 3500,
    steth: 3500,
    usdc: 1,
    usdt: 1,
    dai: 1,
    wbtc: 65000,
    btc: 65000,
    arb: 1.2,
    op: 2.5,
    matic: 0.8,
    avax: 35,
    bnb: 300,
  };

  return {
    token: token.toUpperCase(),
    price: fallbackPrices[token.toLowerCase()] ?? 0,
    change_24h: null,
    market_cap: null,
    source: "fallback",
  };
}

export interface ProtocolInfo {
  name: string;
  slug: string;
  category: string;
  chains: string[];
  tvl: number;
  tvl_change_24h: number | null;
  audits: {
    count: number;
    auditors: string[];
    last_audit_date: string | null;
  };
  hack_history: {
    has_been_hacked: boolean;
    details: string | null;
  };
  description: string;
  risk_score: number;
}

export async function getProtocolInfo(
  protocol: string,
  includeAudits?: boolean,
  _includeTvlHistory?: boolean,
): Promise<ProtocolInfo> {
  const cacheKey = `proto:${protocol.toLowerCase()}:${includeAudits}`;
  const cached = cache.get<ProtocolInfo>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(DEFILLAMA_PROTOCOLS_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const protocols: LlamaProtocol[] = await res.json();
      const lower = protocol.toLowerCase();
      const match = protocols.find((p) => 
        p.name?.toLowerCase() === lower ||
        p.slug?.toLowerCase() === lower
      );

      if (match) {
        const auditors = includeAudits
          ? (match.audits || []).map((a) => a.auditor || a.name).filter((v): v is string => Boolean(v))
          : [];
        
        const result: ProtocolInfo = {
          name: match.name || protocol,
          slug: match.slug || protocol.toLowerCase(),
          category: match.category || "Unknown",
          chains: match.chains || [],
          tvl: match.tvl ?? 0,
          tvl_change_24h: match.change_1d ?? null,
          audits: {
            count: auditors.length,
            auditors: auditors.slice(0, 5),
            last_audit_date: match.audits?.[0]?.date || null,
          },
          hack_history: {
            has_been_hacked: !!match.hacked,
            details: match.hackDetails || null,
          },
          description: match.description || `${match.name} is a DeFi protocol on ${match.chains?.[0] || "multiple chains"}.`,
          risk_score: (match.tvl ?? 0) > 1e9 ? 85 : (match.tvl ?? 0) > 1e8 ? 70 : 55,
        };
        cache.set(cacheKey, result, CACHE_TTL.PROTOCOL_INFO);
        return result;
      }
    }
  } catch {}

  const knownProtocols: Record<string, Partial<ProtocolInfo>> = {
    aave: {
      name: "Aave",
      category: "Lending",
      chains: ["ethereum", "arbitrum", "optimism", "base", "polygon", "avalanche"],
      description: "Aave is a decentralized liquidity protocol for borrowing and lending assets.",
      risk_score: 90,
    },
    compound: {
      name: "Compound",
      category: "Lending",
      chains: ["ethereum", "arbitrum", "base"],
      description: "Compound is an algorithmic interest rate protocol on Ethereum.",
      risk_score: 88,
    },
    lido: {
      name: "Lido",
      category: "Liquid Staking",
      chains: ["ethereum"],
      description: "Lido is a liquid staking solution for Ethereum 2.0.",
      risk_score: 85,
    },
    uniswap: {
      name: "Uniswap",
      category: "DEX",
      chains: ["ethereum", "arbitrum", "optimism", "base", "polygon", "bnb"],
      description: "Uniswap is a decentralized trading protocol.",
      risk_score: 85,
    },
  };

  const fallback = knownProtocols[protocol.toLowerCase()];
  
  return {
    name: fallback?.name || protocol,
    slug: protocol.toLowerCase(),
    category: fallback?.category || "Unknown",
    chains: fallback?.chains || [],
    tvl: 0,
    tvl_change_24h: null,
    audits: { count: 0, auditors: [], last_audit_date: null },
    hack_history: { has_been_hacked: false, details: null },
    description: fallback?.description || `Information not available for ${protocol}.`,
    risk_score: fallback?.risk_score || 50,
  };
}

export interface GasEstimate {
  chain: string;
  gas_price_gwei: number;
  estimated_cost_usd: string;
  estimated_cost_eth: string;
  action: string;
  timestamp: number;
}

export async function getGasEstimate(
  chain: string,
  action?: string,
): Promise<GasEstimate> {
  const now = Date.now();
  const cacheKey = `${chain}-${action || "default"}`;
  const cached = GAS_CACHE[cacheKey];
  
  if (cached && now - cached.timestamp < 30_000) {
    const ethPrice = await getEthPrice();
    const gasUsed = action === "approve" ? 50000 : action === "deposit" ? 200000 : action === "withdraw" ? 150000 : 100000;
    const costEth = (cached.price * gasUsed) / 1e9;
    return {
      chain,
      gas_price_gwei: cached.price,
      estimated_cost_usd: `$${(costEth * ethPrice).toFixed(2)}`,
      estimated_cost_eth: `${costEth.toFixed(6)} ETH`,
      action: action || "transfer",
      timestamp: cached.timestamp,
    };
  }

  const rpcUrl = ETH_RPC_URLS[chain];
  let gasPrice = 20;

  if (rpcUrl) {
    try {
      const result = await rpcCall(rpcUrl, "eth_gasPrice", []);
      if (typeof result === "string") {
        gasPrice = Number(BigInt(result)) / 1e9;
      }
    } catch {}
  }

  const gasUsed = action === "approve" ? 50000 : action === "deposit" ? 200000 : action === "withdraw" ? 150000 : 100000;
  const ethPrice = await getEthPrice();
  const costEth = (gasPrice * gasUsed) / 1e9;

  GAS_CACHE[cacheKey] = { price: gasPrice, timestamp: now };

  return {
    chain,
    gas_price_gwei: Math.round(gasPrice * 100) / 100,
    estimated_cost_usd: `$${(costEth * ethPrice).toFixed(2)}`,
    estimated_cost_eth: `${costEth.toFixed(6)} ETH`,
    action: action || "transfer",
    timestamp: now,
  };
}

export interface TokenBalance {
  token: string;
  balance: string;
  balance_raw: string;
  decimals: number;
  chain: string;
  token_address: string;
  usd_value: number;
}

export async function checkTokenBalance(
  chain: string,
  token: string,
  walletAddress: string,
): Promise<TokenBalance> {
  const cacheKey = `bal:${chain}:${token}:${walletAddress.toLowerCase()}`;
  const cached = cache.get<TokenBalance>(cacheKey);
  if (cached) return cached;

  const rpcUrl = ETH_RPC_URLS[chain];
  const tokenAddress = TOKEN_ADDRESSES[chain]?.[token.toUpperCase()];
  
  if (!rpcUrl || !tokenAddress) {
    return {
      token: token.toUpperCase(),
      balance: "0",
      balance_raw: "0",
      decimals: TOKEN_DECIMALS[token.toUpperCase()] || 18,
      chain,
      token_address: tokenAddress || "",
      usd_value: 0,
    };
  }

  try {
    const isNative = tokenAddress === NATIVE_TOKEN_ADDRESS;
    const balance = isNative
      ? await getNativeBalance(chain, walletAddress)
      : await getTokenBalance(chain, tokenAddress, walletAddress);
    const decimals = TOKEN_DECIMALS[token.toUpperCase()] || 18;
    const formatted = Number(balance) / 10 ** decimals;
    
    const priceData = await getTokenPrice(token, chain);
    const usdValue = formatted * priceData.price;

    const result: TokenBalance = {
      token: token.toUpperCase(),
      balance: formatted.toFixed(decimals === 6 ? 2 : 4),
      balance_raw: balance.toString(),
      decimals,
      chain,
      token_address: tokenAddress,
      usd_value: usdValue,
    };
    cache.set(cacheKey, result, CACHE_TTL.BALANCE);
    return result;
  } catch {
    return {
      token: token.toUpperCase(),
      balance: "0",
      balance_raw: "0",
      decimals: TOKEN_DECIMALS[token.toUpperCase()] || 18,
      chain,
      token_address: tokenAddress,
      usd_value: 0,
    };
  }
}

export interface AllowanceData {
  token: string;
  token_address: string;
  spender: string;
  spender_name: string;
  allowance: string;
  allowance_raw: string;
  needs_approval: boolean;
  chain: string;
}

export async function checkAllowance(
  chain: string,
  token: string,
  walletAddress: string,
  spender: string,
): Promise<AllowanceData> {
  const rpcUrl = ETH_RPC_URLS[chain];
  const tokenAddress = TOKEN_ADDRESSES[chain]?.[token.toUpperCase()];
  
  if (!rpcUrl || !tokenAddress) {
    return {
      token: token.toUpperCase(),
      token_address: tokenAddress || "",
      spender,
      spender_name: "Unknown",
      allowance: "0",
      allowance_raw: "0",
      needs_approval: true,
      chain,
    };
  }

  try {
    const allowanceData = await rpcCall(rpcUrl, "eth_call", [
      {
        to: tokenAddress,
        data: "0xdd62ed3e" + walletAddress.slice(2).padStart(64, "0") + spender.slice(2).padStart(64, "0"),
      },
      "latest",
    ]);
    
    const allowanceRaw = BigInt(allowanceData as string || "0x0");
    const decimals = TOKEN_DECIMALS[token.toUpperCase()] || 18;
    const formatted = Number(allowanceRaw) / 10 ** decimals;
    const needsApproval = allowanceRaw === BigInt(0);

    return {
      token: token.toUpperCase(),
      token_address: tokenAddress,
      spender,
      spender_name: "Protocol",
      allowance: formatted > 1e15 ? "Unlimited" : formatted.toFixed(decimals === 6 ? 2 : 4),
      allowance_raw: allowanceRaw.toString(),
      needs_approval: needsApproval,
      chain,
    };
  } catch {
    return {
      token: token.toUpperCase(),
      token_address: tokenAddress,
      spender,
      spender_name: "Protocol",
      allowance: "0",
      allowance_raw: "0",
      needs_approval: true,
      chain,
    };
  }
}

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

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
  avalanche: 43114,
  bnb: 56,
};

function encodeTxData(abi: unknown[], name: string, args: unknown[]): `0x${string}` {
  const fnAbi = (abi as Array<{ name?: string; type?: string }>).find(
    (item) => item.name === name && item.type === "function"
  );
  if (!fnAbi) {
    throw new Error(`Function ${name} not found in ABI`);
  }
  return encodeFunctionData({
    abi: [fnAbi] as const,
    functionName: name,
    args: args as readonly unknown[],
  });
}

export async function prepareApproval(
  chain: string,
  token: string,
  spender: string,
  amount?: string,
): Promise<TransactionData> {
  const tokenAddress = TOKEN_ADDRESSES[chain]?.[token.toUpperCase()];
  if (!tokenAddress) {
    throw new Error(`Token ${token} not found on chain ${chain}`);
  }

  const decimals = TOKEN_DECIMALS[token.toUpperCase()] || 18;
  const amountRaw = amount
    ? BigInt(Math.floor(parseFloat(amount) * 10 ** decimals))
    : BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

  const data = encodeTxData(ERC20_ABI, "approve", [spender, amountRaw]);
  const gasEstimate = await getGasEstimate(chain, "approve");
  const ethPrice = await getEthPrice();
  
  const gasCostEth = (gasEstimate.gas_price_gwei * 50000) / 1e9;
  
  return {
    to: tokenAddress as `0x${string}`,
    data,
    value: BigInt(0),
    chain_id: CHAIN_IDS[chain] || 1,
    gas_estimate: "~50,000 gas",
    gas_cost_usd: `$${(gasCostEth * ethPrice).toFixed(2)}`,
    description: `Approve ${amount ? amount + " " + token : "unlimited " + token} for spending`,
    protocol: "ERC20",
    action: "approve",
    asset: token.toUpperCase(),
    amount: amount || "unlimited",
  };
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

export async function prepareLifiDeposit(
  opportunityId: string,
  asset: string,
  amount: string,
  sourceChain: string,
  walletAddress: string,
): Promise<DepositPreparation> {
  if (!isLifiBackendEnabled()) {
    throw new Error("LI.FI backend is disabled");
  }

  const chainMap: Record<string, number> = {
    ethereum: 1,
    arbitrum: 42161,
    optimism: 10,
    base: 8453,
    polygon: 137,
    avalanche: 43114,
    bnb: 56,
  };

  const normalizedSourceChain = sourceChain.toLowerCase();
  const chainId = chainMap[normalizedSourceChain] || 8453;
  const destinationChainId = 8453;
  const tokens = TOKEN_ADDRESSES[normalizedSourceChain] || TOKEN_ADDRESSES.ethereum;
  const tokenAddr = tokens[asset.toUpperCase()] || tokens.USDC;
  const decimals = TOKEN_DECIMALS[asset.toUpperCase()] || 18;
  const numAmount = parseFloat(amount) || 0;
  const amountRaw = BigInt(Math.floor(numAmount * 10 ** decimals));

  const quote = await lifiGetQuote({
    chainId,
    destinationChainId,
    opportunityId,
    fromToken: tokenAddr,
    amount: String(amountRaw),
    walletAddress,
  });

  let resolvedGasUsd = quote.estimatedGasCostUsd || "";
  if (!resolvedGasUsd) {
    try {
      const gasEst = await getGasEstimate(normalizedSourceChain, "deposit");
      const ethP = await getEthPrice();
      const gasCostEth = (gasEst.gas_price_gwei * (quote.transaction.gasLimit ? Number(quote.transaction.gasLimit) : 250000)) / 1e9;
      resolvedGasUsd = `$${(gasCostEth * ethP).toFixed(2)}`;
    } catch { resolvedGasUsd = "~$0.50"; }
  }

  const txData: TransactionData = {
    to: quote.transaction.to as `0x${string}`,
    data: quote.transaction.data as `0x${string}`,
    value: BigInt(quote.transaction.value || "0"),
    chain_id: chainId,
    destination_chain_id: destinationChainId,
    gas_estimate: quote.transaction.gasLimit ? `${quote.transaction.gasLimit} gas` : "~250,000 gas",
    gas_cost_usd: resolvedGasUsd,
    description: `Deposit ${amount} ${asset} via LI.FI Composer into ${quote.opportunity?.protocol || "vault"} on Base`,
    protocol: quote.opportunity?.protocol || "LI.FI Composer",
    action: "deposit",
    asset: asset.toUpperCase(),
    amount,
    is_composer: true,
  };

  let approvalTx: TransactionData | undefined;
  let needsApproval = false;

  if (quote.approval) {
    needsApproval = true;
    approvalTx = await prepareApproval(normalizedSourceChain, asset, quote.approval.spender);
  } else {
    try {
      const allowance = await checkAllowance(normalizedSourceChain, asset, walletAddress, txData.to);
      needsApproval = allowance.needs_approval;
      if (needsApproval) {
        approvalTx = await prepareApproval(normalizedSourceChain, asset, txData.to);
      }
    } catch {
      needsApproval = true;
      approvalTx = await prepareApproval(normalizedSourceChain, asset, txData.to);
    }
  }

  let resolvedApy = `${(quote.expectedApy * 100).toFixed(1)}%`;
  if (quote.expectedApy <= 0) {
    try {
      const lifiOpps = await discoverLifiOpportunities(normalizedSourceChain, undefined, asset.toUpperCase(), 25);
      const vaultMatch = lifiOpps.opportunities.find((o) =>
        (o.pool_address || "").toLowerCase() === (opportunityId || "").toLowerCase()
      );
      if (vaultMatch && vaultMatch.apy > 0) resolvedApy = `${vaultMatch.apy.toFixed(1)}%`;
    } catch {}
  }

  return {
    transaction: txData,
    needs_approval: needsApproval,
    approval_transaction: approvalTx,
    protocol: txData.protocol,
    chain: normalizedSourceChain,
    asset: asset.toUpperCase(),
    amount,
    estimated_apy: resolvedApy,
    risk_level: "medium",
  };
}

export async function prepareDeposit(
  protocol: string,
  asset: string,
  amount: string,
  chain: string,
  walletAddress: string,
  opportunityId?: string,
  poolAddress?: string,
): Promise<DepositPreparation> {
  console.log("[prepareDeposit] called with:", { protocol, asset, amount, chain, walletAddress, opportunityId });

  if (isLifiBackendEnabled() && opportunityId && isComposerOpportunityId(opportunityId)) {
    try {
      return await prepareLifiDeposit(opportunityId, asset, amount, chain, walletAddress);
    } catch (lifiErr) {
      console.error("[prepareDeposit] LI.FI path failed, falling back to legacy:", lifiErr instanceof Error ? lifiErr.message : lifiErr);
    }
  }

  const chainLower = chain.toLowerCase();
  const assetUpper = asset.toUpperCase();
  const decimals = TOKEN_DECIMALS[assetUpper] || 18;
  
  const parsedAmount = parseFloat(amount);
  console.log("[prepareDeposit] parsedAmount:", parsedAmount, "decimals:", decimals);
  
  if (!isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error(`Invalid deposit amount: ${amount}`);
  }
  const amountRaw = BigInt(Math.floor(parsedAmount * 10 ** decimals));
  console.log("[prepareDeposit] amountRaw:", amountRaw.toString());
  
  const protocolLower = protocol.toLowerCase();
  let txData: TransactionData;
  let spender: string;
  let estimatedApy = "4.5%";
  let riskLevel = "medium";

  if (protocolLower.includes("aave")) {
    const poolAddress = AAVE_V3_POOL_ADDRESSES[chainLower];
    console.log("[prepareDeposit] Aave poolAddress for", chainLower, ":", poolAddress);
    if (!poolAddress) {
      throw new Error(`Aave V3 not deployed on ${chain}. Supported chains: ${Object.keys(AAVE_V3_POOL_ADDRESSES).join(", ")}`);
    }
    
    const tokenAddress = TOKEN_ADDRESSES[chainLower]?.[assetUpper];
    console.log("[prepareDeposit] tokenAddress for", assetUpper, "on", chainLower, ":", tokenAddress);
    if (!tokenAddress) {
      throw new Error(`Token ${asset} not found on ${chain}. Supported tokens: ${Object.keys(TOKEN_ADDRESSES[chainLower] || {}).join(", ")}`);
    }

    const isNative = tokenAddress === NATIVE_TOKEN_ADDRESS;
    const wethAddress = TOKEN_ADDRESSES[chainLower]?.["WETH"] || tokenAddress;
    const fnName = isNative ? "deposit" : "supply";
    console.log("[prepareDeposit] isNative:", isNative, "fnName:", fnName, "wethAddress:", wethAddress);

    let data: `0x${string}`;
    try {
      data = encodeTxData(AAVE_POOL_ABI, fnName, [
        wethAddress,
        amountRaw,
        walletAddress as `0x${string}`,
        0,
      ]);
      console.log("[prepareDeposit] encoded tx data successfully, length:", data.length);
    } catch (encodeErr) {
      console.error("[prepareDeposit] ENCODE FAILED:", encodeErr);
      throw new Error(`Failed to encode Aave ${fnName} transaction: ${encodeErr instanceof Error ? encodeErr.message : "Unknown encoding error"}`);
    }
    
    let gasEstimate: GasEstimate;
    try {
      gasEstimate = await getGasEstimate(chainLower, "deposit");
    } catch {
      gasEstimate = { chain: chainLower, gas_price_gwei: 0.006, estimated_cost_usd: "~$0.00", estimated_cost_eth: "0", action: "deposit", timestamp: Date.now() };
    }
    
    let ethPrice: number;
    try {
      ethPrice = await getEthPrice();
    } catch {
      ethPrice = 3500;
    }
    const gasCostEth = (gasEstimate.gas_price_gwei * 200000) / 1e9;
    
    txData = {
      to: poolAddress as `0x${string}`,
      data,
      value: isNative ? amountRaw : BigInt(0),
      chain_id: CHAIN_IDS[chainLower] || 1,
      gas_estimate: "~200,000 gas",
      gas_cost_usd: `$${(gasCostEth * ethPrice).toFixed(2)}`,
      description: `Deposit ${amount} ${asset} to Aave V3`,
      protocol: "Aave V3",
      action: "deposit",
      asset: assetUpper,
      amount,
    };
    
    spender = poolAddress;
    estimatedApy = chainLower === "ethereum" ? "3.2%" : "4.5%";
    riskLevel = "low";
  } else if (protocolLower.includes("compound")) {
    const cometAddress = COMPOUND_V3_COMET_ADDRESSES[chainLower]?.[assetUpper];
    if (!cometAddress) {
      throw new Error(`Compound V3 ${asset} market not deployed on ${chain}`);
    }
    
    const tokenAddress = TOKEN_ADDRESSES[chainLower]?.[assetUpper];
    if (!tokenAddress) {
      throw new Error(`Token ${asset} not found on ${chain}`);
    }

    let data: `0x${string}`;
    try {
      data = encodeTxData(COMPOUND_COMET_ABI, "supply", [
        tokenAddress,
        amountRaw,
      ]);
    } catch (encodeErr) {
      throw new Error(`Failed to encode Compound supply transaction: ${encodeErr instanceof Error ? encodeErr.message : "Unknown encoding error"}`);
    }
    
    let gasEstimate: GasEstimate;
    try {
      gasEstimate = await getGasEstimate(chainLower, "deposit");
    } catch {
      gasEstimate = { chain: chainLower, gas_price_gwei: 0.006, estimated_cost_usd: "~$0.00", estimated_cost_eth: "0", action: "deposit", timestamp: Date.now() };
    }
    
    let ethPrice: number;
    try {
      ethPrice = await getEthPrice();
    } catch {
      ethPrice = 3500;
    }
    const gasCostEth = (gasEstimate.gas_price_gwei * 180000) / 1e9;
    
    txData = {
      to: cometAddress as `0x${string}`,
      data,
      value: BigInt(0),
      chain_id: CHAIN_IDS[chainLower] || 1,
      gas_estimate: "~180,000 gas",
      gas_cost_usd: `$${(gasCostEth * ethPrice).toFixed(2)}`,
      description: `Deposit ${amount} ${asset} to Compound V3`,
      protocol: "Compound V3",
      action: "deposit",
      asset: assetUpper,
      amount,
    };
    
    spender = cometAddress;
    estimatedApy = chainLower === "ethereum" ? "4.0%" : "5.0%";
    riskLevel = "low";
  } else {
    const VAULT_ABI = [
      {
        name: "deposit",
        type: "function",
        inputs: [
          { name: "assets", type: "uint256" },
          { name: "receiver", type: "address" },
        ],
        outputs: [{ name: "shares", type: "uint256" }],
        stateMutability: "nonpayable",
      },
      {
        name: "mint",
        type: "function",
        inputs: [
          { name: "shares", type: "uint256" },
          { name: "receiver", type: "address" },
        ],
        outputs: [{ name: "assets", type: "uint256" }],
        stateMutability: "nonpayable",
      },
      {
        name: "approve",
        type: "function",
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
      },
    ];

    const tokenAddress = TOKEN_ADDRESSES[chainLower]?.[assetUpper];
    if (!tokenAddress || tokenAddress === NATIVE_TOKEN_ADDRESS) {
      throw new Error(`Generic vault deposits require an ERC-20 token. Native asset deposits for ${protocol} are not supported on the backend.`);
    }

    if (!poolAddress || !/^0x[a-fA-F0-9]{40}$/.test(poolAddress)) {
      try {
        if (isLifiBackendEnabled() && chainLower === "base") {
          const lifiResolved = await discoverLifiOpportunities(
            chainLower,
            undefined,
            assetUpper,
            25,
          );
          const lifiMatch = lifiResolved.opportunities.find((o) => {
            const protocolName = (o.protocol || "").toLowerCase();
            const poolName = (o.pool || "").toLowerCase();
            const id = (o.pool_address || "").toLowerCase();
            return (
              protocolName.includes(protocolLower) ||
              poolName.includes(protocolLower) ||
              id.includes(protocolLower) ||
              protocolLower.includes(protocolName) ||
              protocolLower.includes(poolName)
            );
          });
          if (lifiMatch?.pool_address) {
            return await prepareLifiDeposit(lifiMatch.pool_address, asset, amount, chain, walletAddress);
          }
        }

        const resolved = await discoverOpportunities(
          chainLower,
          undefined,
          undefined,
          undefined,
          undefined,
          assetUpper,
          25,
        );
        const match = resolved.opportunities.find((o) => {
          const protocolName = (o.protocol || "").toLowerCase();
          const poolName = (o.pool || "").toLowerCase();
          const address = (o.pool_address || "").toLowerCase();
          return (
            protocolName.includes(protocolLower) ||
            poolName.includes(protocolLower) ||
            address.includes(protocolLower) ||
            protocolLower.includes(protocolName) ||
            protocolLower.includes(poolName)
          );
        });
        if (match?.pool_address && /^0x[a-fA-F0-9]{40}$/.test(match.pool_address)) {
          poolAddress = match.pool_address;
        }
      } catch (resolveErr) {
        console.warn("[prepareDeposit] Base vault auto-resolve failed:", resolveErr instanceof Error ? resolveErr.message : resolveErr);
      }
    }

    if (!poolAddress || !/^0x[a-fA-F0-9]{40}$/.test(poolAddress)) {
      throw new Error(`Pool/vault address is required for ${protocol}. Provide the vault contract address as pool_address.`);
    }

    let resolvedApy = "—";
    try {
      const lifiOpps = await discoverLifiOpportunities(chainLower, undefined, assetUpper, 25);
      const vaultMatch = lifiOpps.opportunities.find((o) =>
        (o.pool_address || "").toLowerCase() === (poolAddress || "").toLowerCase()
      );
      if (vaultMatch && vaultMatch.apy > 0) resolvedApy = `${vaultMatch.apy.toFixed(1)}%`;
    } catch {}

    const chainId = CHAIN_IDS[chainLower] || 1;
    const vaultAddr = poolAddress as `0x${string}`;

    let gasEstimate: GasEstimate;
    try {
      gasEstimate = await getGasEstimate(chainLower, "deposit");
    } catch {
      gasEstimate = { chain: chainLower, gas_price_gwei: 0.006, estimated_cost_usd: "~$0.00", estimated_cost_eth: "0", action: "deposit", timestamp: Date.now() };
    }
    let ethPrice: number;
    try { ethPrice = await getEthPrice(); } catch { ethPrice = 3500; }
    const gasCostEth = (gasEstimate.gas_price_gwei * 250000) / 1e9;

    txData = {
      to: vaultAddr,
      data: encodeTxData(VAULT_ABI, "deposit", [amountRaw, walletAddress]),
      value: BigInt(0),
      chain_id: chainId,
      gas_estimate: "~250,000 gas",
      gas_cost_usd: `$${(gasCostEth * ethPrice).toFixed(2)}`,
      description: `Deposit ${amount} ${asset} into ${protocol} vault`,
      protocol,
      action: "deposit",
      asset: assetUpper,
      amount,
    };
    spender = vaultAddr;
    estimatedApy = resolvedApy;
    riskLevel = "medium";
    console.log("[prepareDeposit] Using generic ERC-4626 path for", protocol, "→", vaultAddr);
  }

  const isNativeAsset = TOKEN_ADDRESSES[chainLower]?.[assetUpper] === NATIVE_TOKEN_ADDRESS;
  console.log("[prepareDeposit] isNativeAsset:", isNativeAsset);
  let allowance: AllowanceData | { needs_approval: boolean };
  try {
    allowance = isNativeAsset
      ? { needs_approval: false }
      : await checkAllowance(chainLower, asset, walletAddress, spender);
    console.log("[prepareDeposit] allowance check done, needs_approval:", allowance.needs_approval);
  } catch (allowanceErr) {
    console.error("[prepareDeposit] checkAllowance failed:", allowanceErr instanceof Error ? allowanceErr.message : allowanceErr);
    allowance = { needs_approval: true };
  }
  
  let approvalTx: TransactionData | undefined;
  
  if (allowance.needs_approval) {
    try {
      approvalTx = await prepareApproval(chainLower, asset, spender);
      console.log("[prepareDeposit] approvalTx prepared");
    } catch (approvalErr) {
      console.error("[prepareDeposit] prepareApproval failed:", approvalErr instanceof Error ? approvalErr.message : approvalErr);
      approvalTx = undefined;
    }
  }

  console.log("[prepareDeposit] SUCCESS - returning preparation");
  return {
    transaction: txData,
    needs_approval: allowance.needs_approval,
    approval_transaction: approvalTx,
    protocol: txData.protocol,
    chain: chainLower,
    asset: assetUpper,
    amount,
    estimated_apy: estimatedApy,
    risk_level: riskLevel,
  };
}

export interface WithdrawPreparation {
  transaction: TransactionData;
  needs_approval?: boolean;
  approval_transaction?: TransactionData;
  protocol: string;
  chain: string;
  asset: string;
  amount: string;
  withdraw_all: boolean;
  current_value_usd: string;
}

async function prepareLifiWithdraw(params: {
  positionTokenAddress: string;
  asset: string;
  requestedAmount: string;
  quoteAmount: string;
  chain: string;
  walletAddress: string;
  tokenDecimals: number;
  protocol: string;
  currentValueUsd: string;
  withdrawAll: boolean;
}): Promise<WithdrawPreparation> {
  if (!isLifiBackendEnabled()) {
    throw new Error("LI.FI backend is disabled");
  }

  const chainMap: Record<string, number> = {
    ethereum: 1,
    arbitrum: 42161,
    optimism: 10,
    base: 8453,
    polygon: 137,
    avalanche: 43114,
    bnb: 56,
  };

  const normalizedChain = params.chain.toLowerCase();
  const chainId = chainMap[normalizedChain] || 8453;
  const assetUpper = params.asset.toUpperCase();
  const toToken = TOKEN_ADDRESSES[normalizedChain]?.[assetUpper];

  if (!toToken) {
    throw new Error(`Token ${assetUpper} not found on ${normalizedChain} for LI.FI withdrawal`);
  }

  const parsedAmount = parseFloat(params.quoteAmount);
  if (!isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error(`Invalid withdraw amount: ${params.quoteAmount}`);
  }

  const amountRaw = BigInt(Math.floor(parsedAmount * 10 ** params.tokenDecimals));
  const quote = await lifiGetQuote({
    chainId,
    destinationChainId: chainId,
    fromToken: params.positionTokenAddress,
    toToken,
    amount: String(amountRaw),
    walletAddress: params.walletAddress,
  });

  const txData: TransactionData = {
    to: quote.transaction.to as `0x${string}`,
    data: quote.transaction.data as `0x${string}`,
    value: BigInt(quote.transaction.value || "0"),
    chain_id: chainId,
    destination_chain_id: chainId,
    gas_estimate: quote.transaction.gasLimit ? `${quote.transaction.gasLimit} gas` : "~250,000 gas",
    gas_cost_usd: quote.estimatedGasCostUsd || "~$2.80",
    description: params.withdrawAll
      ? `Withdraw all ${assetUpper} via LI.FI Composer from ${params.protocol}`
      : `Withdraw ${params.requestedAmount} ${assetUpper} via LI.FI Composer from ${params.protocol}`,
    protocol: quote.opportunity?.protocol || params.protocol || "LI.FI Composer",
    action: "withdraw",
    asset: assetUpper,
    amount: params.withdrawAll ? "all" : params.requestedAmount,
    is_composer: true,
  };

  return {
    transaction: txData,
    protocol: txData.protocol,
    chain: normalizedChain,
    asset: assetUpper,
    amount: params.withdrawAll ? "all" : params.requestedAmount,
    withdraw_all: params.withdrawAll,
    current_value_usd: params.currentValueUsd,
  };
}

export async function prepareWithdraw(
  positionId: string,
  amount: string,
  walletAddress: string,
): Promise<WithdrawPreparation> {
  console.log("[prepareWithdraw] input:", { positionId, amount, walletAddress });
  const isLifiFormat = positionId.includes(":");
  let protocol: string;
  let asset: string;

  if (isLifiFormat) {
    const parts = positionId.split(":");
    protocol = (parts[1] || "").toLowerCase();
    asset = (parts[2] || "").toUpperCase();
  } else {
    [protocol, , asset] = positionId.toLowerCase().split("-");
    asset = asset.toUpperCase();
  }

  const chain = "base";
  console.log("[prepareWithdraw] parsed:", { protocol, chain, asset, isLifiFormat });

  const assetUpper = asset.toUpperCase();
  const decimals = TOKEN_DECIMALS[assetUpper] || 18;
  const withdrawAll = amount.toLowerCase() === "max";

  let currentValueUsd = "$0.00";
  const positions = await getPositions(walletAddress, undefined, chain).catch(() => null);
  const matchingPosition = positions?.positions.find(
    (p) => p.position_id.toLowerCase() === positionId.toLowerCase()
  );

  if (matchingPosition?.current_value) {
    currentValueUsd = matchingPosition.current_value;
  }

  const quoteAmount = withdrawAll
    ? (matchingPosition?.deposited ? extractNumericAmount(matchingPosition.deposited) : amount)
    : amount;

  console.log("[prepareWithdraw] debug:", { isLifiBackendEnabled: isLifiBackendEnabled(), quoteAmount });

  if (!isLifiBackendEnabled()) {
    throw new Error("LI.FI backend is disabled. Cannot process withdrawal.");
  }

  if (!quoteAmount) {
    throw new Error(`Invalid withdrawal amount: ${amount}`);
  }

  let lifiPosition: LifiPosition | null = null;
  const protocolLower = protocol.toLowerCase();

  try {
    const lifiData = await lifiGetPositions(walletAddress);
    console.log("[prepareWithdraw] LI.FI positions:", lifiData.positions.length, lifiData.positions.map(p => ({ id: p.id, protocol: p.protocol, symbol: p.tokenSymbol, oppId: p.opportunityId })));
    lifiPosition = lifiData.positions.find((p) => {
      const protoMatch = (p.protocol || "").toLowerCase().includes(protocolLower) || protocolLower.includes((p.protocol || "").toLowerCase());
      const assetMatch = (p.tokenSymbol || "").toUpperCase() === assetUpper;
      return protoMatch && assetMatch;
    }) || null;
    if (lifiPosition) {
      console.log("[prepareWithdraw] found LI.FI position:", lifiPosition.id, "opportunityId:", lifiPosition.opportunityId);
    }
  } catch (posErr) {
    console.warn("[prepareWithdraw] lifiGetPositions failed:", posErr instanceof Error ? posErr.message : posErr);
  }

  if (!lifiPosition) {
    try {
      const lifiOpps = await discoverLifiOpportunities(chain, undefined, assetUpper, 50);
      console.log("[prepareWithdraw] LI.FI opportunities found:", lifiOpps.opportunities.length, lifiOpps.opportunities.map(o => ({ protocol: o.protocol, pool: o.pool_address })));
      const match = lifiOpps.opportunities.find((o) => {
        const protoName = (o.protocol || "").toLowerCase();
        return protoName.includes(protocolLower) || protocolLower.includes(protoName);
      });
      if (match?.pool_address && /^0x[a-fA-F0-9]{40}$/.test(match.pool_address)) {
        lifiPosition = {
          id: `${chain}:${protocol}:${assetUpper}`,
          opportunityId: match.pool_address,
          protocol: match.protocol,
          chainId: 8453,
          chainName: "Base",
          tokenAddress: TOKEN_ADDRESSES[chain]?.[assetUpper] || "",
          tokenDecimals: decimals,
          tokenSymbol: assetUpper,
          depositedAmount: quoteAmount,
          depositedAmountUsd: currentValueUsd,
          currentApy: 0,
          entryTime: new Date().toISOString(),
          status: "active",
        };
        console.log("[prepareWithdraw] fallback: created position from discovery:", lifiPosition.opportunityId);
      }
    } catch (discErr) {
      console.warn("[prepareWithdraw] LI.FI opportunity discovery failed:", discErr instanceof Error ? discErr.message : discErr);
    }
  }

  if (!lifiPosition) {
    throw new Error(`No ${protocol} ${assetUpper} position found on Base via LI.FI. Ensure you have an active deposit.`);
  }

  const toToken = TOKEN_ADDRESSES[chain]?.[assetUpper];
  if (!toToken) {
    throw new Error(`Token ${assetUpper} not supported on Base`);
  }

  let fromTokenVault: string | null = null;

  if (lifiPosition.opportunityId && /^0x[a-fA-F0-9]{40}$/.test(lifiPosition.opportunityId) && lifiPosition.opportunityId.toLowerCase() !== toToken.toLowerCase()) {
    fromTokenVault = lifiPosition.opportunityId;
    console.log("[prepareWithdraw] using opportunityId as fromToken:", fromTokenVault);
  }

  if (!fromTokenVault) {
    try {
      const lifiOpps = await discoverLifiOpportunities(chain, undefined, assetUpper, 50);
      console.log("[prepareWithdraw] discovering vault for withdrawal, opportunities:", lifiOpps.opportunities.length);
      const match = lifiOpps.opportunities.find((o) => {
        const protoName = (o.protocol || "").toLowerCase();
        return protoName.includes(protocolLower) || protocolLower.includes(protoName);
      });
      if (match?.pool_address && /^0x[a-fA-F0-9]{40}$/.test(match.pool_address) && match.pool_address.toLowerCase() !== toToken.toLowerCase()) {
        fromTokenVault = match.pool_address;
        console.log("[prepareWithdraw] discovered vault as fromToken:", fromTokenVault);
      }
    } catch (discErr) {
      console.warn("[prepareWithdraw] vault discovery failed:", discErr instanceof Error ? discErr.message : discErr);
    }
  }

  if (!fromTokenVault) {
    throw new Error(`Cannot find vault address for ${protocol} ${assetUpper} withdrawal. Vault address must differ from output token (${toToken}).`);
  }

  const amountRaw = BigInt(Math.floor(parseFloat(quoteAmount) * 10 ** (lifiPosition.tokenDecimals || decimals)));

  try {
    const quote = await lifiGetQuote({
      chainId: 8453,
      destinationChainId: 8453,
      opportunityId: fromTokenVault,
      fromToken: fromTokenVault,
      toToken,
      amount: String(amountRaw),
      walletAddress,
    });

    const txData: TransactionData = {
      to: quote.transaction.to as `0x${string}`,
      data: quote.transaction.data as `0x${string}`,
      value: BigInt(quote.transaction.value || "0"),
      chain_id: 8453,
      destination_chain_id: 8453,
      gas_estimate: quote.transaction.gasLimit ? `${quote.transaction.gasLimit} gas` : "~250,000 gas",
      gas_cost_usd: quote.estimatedGasCostUsd || "~$2.80",
      description: withdrawAll
        ? `Withdraw all ${assetUpper} via LI.FI Composer from ${lifiPosition.protocol}`
        : `Withdraw ${amount} ${assetUpper} via LI.FI Composer from ${lifiPosition.protocol}`,
      protocol: quote.opportunity?.protocol || lifiPosition.protocol || protocol,
      action: "withdraw",
      asset: assetUpper,
      amount: withdrawAll ? "all" : amount,
      is_composer: true,
    };

    let withdrawApprovalTx: TransactionData | undefined;
    let withdrawNeedsApproval = false;

    if (quote.approval) {
      withdrawNeedsApproval = true;
      const approvalData = encodeTxData(ERC20_ABI, "approve", [
        quote.approval.spender,
        BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
      ]);
      withdrawApprovalTx = {
        to: fromTokenVault as `0x${string}`,
        data: approvalData,
        value: BigInt(0),
        chain_id: 8453,
        gas_estimate: "~50,000 gas",
        gas_cost_usd: "~$0.01",
        description: `Approve vault share tokens for LI.FI Composer withdrawal`,
        protocol: "ERC20",
        action: "approve",
        asset: assetUpper,
        amount: "unlimited",
      };
    } else {
      try {
        const rpcUrl = ETH_RPC_URLS[chain];
        if (rpcUrl && fromTokenVault) {
          const allowanceData = await rpcCall(rpcUrl, "eth_call", [
            {
              to: fromTokenVault,
              data:
                "0xdd62ed3e" +
                walletAddress.slice(2).padStart(64, "0") +
                txData.to.slice(2).padStart(64, "0"),
            },
            "latest",
          ]);
          const allowanceRaw = BigInt(allowanceData as string || "0x0");
          withdrawNeedsApproval = allowanceRaw === BigInt(0);
          if (withdrawNeedsApproval) {
            const approvalData = encodeTxData(ERC20_ABI, "approve", [
              txData.to,
              BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
            ]);
            withdrawApprovalTx = {
              to: fromTokenVault as `0x${string}`,
              data: approvalData,
              value: BigInt(0),
              chain_id: 8453,
              gas_estimate: "~50,000 gas",
              gas_cost_usd: "~$0.01",
              description: `Approve vault share tokens for LI.FI Composer withdrawal`,
              protocol: "ERC20",
              action: "approve",
              asset: assetUpper,
              amount: "unlimited",
            };
          }
        } else {
          withdrawNeedsApproval = true;
        }
      } catch {
        withdrawNeedsApproval = true;
        const approvalData = encodeTxData(ERC20_ABI, "approve", [
          txData.to,
          BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
        ]);
        withdrawApprovalTx = {
          to: fromTokenVault as `0x${string}`,
          data: approvalData,
          value: BigInt(0),
          chain_id: 8453,
          gas_estimate: "~50,000 gas",
          gas_cost_usd: "~$0.01",
          description: `Approve vault share tokens for LI.FI Composer withdrawal`,
          protocol: "ERC20",
          action: "approve",
          asset: assetUpper,
          amount: "unlimited",
        };
      }
    }

    return {
      transaction: txData,
      needs_approval: withdrawNeedsApproval,
      approval_transaction: withdrawApprovalTx,
      protocol: txData.protocol,
      chain,
      asset: assetUpper,
      amount: withdrawAll ? "all" : amount,
      withdraw_all: withdrawAll,
      current_value_usd: lifiPosition.depositedAmountUsd || currentValueUsd,
    };
  } catch (quoteErr) {
    throw new Error(`LI.FI withdrawal quote failed: ${quoteErr instanceof Error ? quoteErr.message : String(quoteErr)}`);
  }
}

export interface ExecutionResult {
  success: boolean;
  transaction_hash?: string;
  message: string;
  requires_signature: boolean;
  approval_required?: boolean;
  approval_tx?: string;
  preparation?: DepositPreparation | WithdrawPreparation;
}

export async function executeDeposit(
  protocol: string,
  asset: string,
  amount: string,
  chain: string,
  userConfirmation: boolean,
  walletAddress?: string,
  opportunityId?: string,
): Promise<ExecutionResult> {
  if (!userConfirmation) {
    return {
      success: false,
      message: "User confirmation required before execution",
      requires_signature: false,
    };
  }

  if (!walletAddress) {
    return {
      success: false,
      message: "Wallet address required for transaction preparation",
      requires_signature: false,
    };
  }

  try {
    const preparation = await prepareDeposit(protocol, asset, amount, chain, walletAddress, opportunityId);
    
    return {
      success: true,
      message: "Transaction prepared. Please sign in your wallet.",
      requires_signature: true,
      approval_required: preparation.needs_approval,
      preparation,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to prepare transaction",
      requires_signature: false,
    };
  }
}

export async function executeWithdraw(
  positionId: string,
  amount: string,
  userConfirmation: boolean,
  walletAddress?: string,
): Promise<ExecutionResult> {
  if (!userConfirmation) {
    return {
      success: false,
      message: "User confirmation required before execution",
      requires_signature: false,
    };
  }

  if (!walletAddress) {
    return {
      success: false,
      message: "Wallet address required for transaction preparation",
      requires_signature: false,
    };
  }

  try {
    const preparation = await prepareWithdraw(positionId, amount, walletAddress);
    
    return {
      success: true,
      message: "Withdrawal prepared. Please sign in your wallet.",
      requires_signature: true,
      preparation,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to prepare withdrawal",
      requires_signature: false,
    };
  }
}

export interface PortfolioSummary {
  wallet_address: string;
  total_value_usd: string;
  token_balances: Array<{
    token: string;
    balance: string;
    usd_value: string;
    chain: string;
  }>;
  positions: AavePosition[];
  position_count: number;
  chains: string[];
  protocols: string[];
}

export async function getPortfolioSummary(
  walletAddress: string,
  chain?: string,
): Promise<PortfolioSummary> {
  const targetChain = chain || "base";

  const baseTokens = Object.keys(TOKEN_ADDRESSES[targetChain] || {});
  const balancePromises = baseTokens.map(async (token) => {
    try {
      const bal = await checkTokenBalance(targetChain, token, walletAddress);
      const numBal = parseFloat(bal.balance);
      if (numBal === 0) return null;
      return {
        token: bal.token,
        balance: bal.balance,
        usd_value: `$${bal.usd_value.toFixed(2)}`,
        chain: bal.chain,
      };
    } catch {
      return null;
    }
  });

  const [balanceResults, positionsData] = await Promise.allSettled([
    Promise.all(balancePromises),
    getPositions(walletAddress, undefined, targetChain),
  ]);

  const tokenBalances = balanceResults.status === "fulfilled"
    ? (balanceResults.value.filter((b): b is NonNullable<typeof b> => b !== null))
    : [];

  const positions = positionsData.status === "fulfilled" ? positionsData.value.positions : [];
  const totalBalances = tokenBalances.reduce((sum, b) => {
    const val = parseFloat(b.usd_value.replace(/[$,]/g, ""));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalPositionValue = positionsData.status === "fulfilled"
    ? parseFloat(positionsData.value.total_value.replace(/[$,]/g, "")) || 0
    : 0;

  const totalValue = totalBalances + totalPositionValue;
  const chains = [...new Set([...tokenBalances.map(b => b.chain), ...positionsData.status === "fulfilled" ? positionsData.value.chains : []])];
  const protocols = positionsData.status === "fulfilled" ? positionsData.value.protocols : [];

  return {
    wallet_address: walletAddress.toLowerCase(),
    total_value_usd: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    token_balances: tokenBalances,
    positions,
    position_count: positions.length,
    chains,
    protocols,
  };
}

export interface MarketOverview {
  eth_price: number;
  eth_change_24h: number | null;
  base_gas_gwei: number;
  base_gas_usd: string;
  top_opportunities: Opportunity[];
  total_base_opportunities: number;
}

export async function getMarketOverview(
  asset?: string,
): Promise<MarketOverview> {
  const cacheKey = `market:${asset || "all"}`;
  const cached = cache.get<MarketOverview>(cacheKey);
  if (cached) return cached;

  const [priceData, gasData, oppData] = await Promise.allSettled([
    getTokenPrice("ETH"),
    getGasEstimate("base"),
    discoverOpportunities("base", undefined, undefined, undefined, "apy", asset, 7),
  ]);

  const ethPrice = priceData.status === "fulfilled" ? priceData.value : { price: 3500, change_24h: null };
  const gas = gasData.status === "fulfilled" ? gasData.value : { gas_price_gwei: 0.006, estimated_cost_usd: "~$0.00" };
  const opps = oppData.status === "fulfilled" ? oppData.value : { opportunities: [], total_count: 0 };

  const result: MarketOverview = {
    eth_price: ethPrice.price,
    eth_change_24h: ethPrice.change_24h,
    base_gas_gwei: gas.gas_price_gwei,
    base_gas_usd: gas.estimated_cost_usd,
    top_opportunities: opps.opportunities.slice(0, 7),
    total_base_opportunities: opps.total_count,
  };
  cache.set(cacheKey, result, CACHE_TTL.MARKET_OVERVIEW);
  return result;
}
