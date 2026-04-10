import { encodeFunctionData } from "viem";

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
const LIFI_API_URL = "https://api.li.fi/v1/advanced/step";
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

const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
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
    const res = await fetch(`${DEFILLAMA_PRICES_URL}coingecko:ethereum`);
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
  const res = await fetch(DEFILLAMA_YIELDS_URL, {
    next: { revalidate: 300 },
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

  const totalCount = pools.length;

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
    pools = pools.sort((a: LlamaPool, b: LlamaPool) => (b.apy ?? 0) - (a.apy ?? 0));
  }

  const maxLimit = Math.min(limit || 20, 50);
  const opportunities: Opportunity[] = pools.slice(0, maxLimit).map((pool: LlamaPool) => ({
    protocol: pool.protocol,
    pool: pool.symbol || pool.name || pool.pool || "Unknown",
    chain: LLAMA_TO_CHAIN[pool.chain] || pool.chain?.toLowerCase() || "unknown",
    asset: pool.symbol || pool.underlyingTokens?.[0] || "Unknown",
    apy: Math.round((pool.apy ?? 0) * 100) / 100,
    tvl: formatTVL(pool.tvlUsd ?? 0),
    risk_level: assessRiskLevel(pool),
    pool_address: pool.pool || "",
    stablecoin: !!pool.stablecoin,
    apy_base: pool.apyBase != null ? Math.round(pool.apyBase * 100) / 100 : null,
    apy_reward: pool.apyReward != null ? Math.round(pool.apyReward * 100) / 100 : null,
    tvl_usd: pool.tvlUsd ?? 0,
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
          });
        }
      } catch {}
    }),
  );

  return allPositions;
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

  const results = await Promise.allSettled(fetchPromises);
  const positions = results
    .filter((r): r is PromiseFulfilledResult<AavePosition[]> => r.status === "fulfilled")
    .flatMap(r => r.value);

  const totalValue = positions.reduce((sum, p) => {
    const match = p.current_value.match(/\$?([\d,.]+)/);
    const val = match ? parseFloat(match[1].replace(/,/g, "")) : 0;
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const chains = [...new Set(positions.map(p => p.chain))];
  const protocolNames = [...new Set(positions.map(p => p.protocol))];

  return {
    wallet_address: walletAddress.toLowerCase(),
    total_value: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    positions,
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

export async function getQuote(
  action: string,
  amount: string,
  asset: string,
  poolAddress: string,
  chain?: string,
  slippageTolerance?: string,
): Promise<QuoteData> {
  const ethPrice = await getEthPrice();
  const numAmount = parseFloat(amount) || 0;
  const isDeposit = action === "deposit";
  const targetChain = chain || "ethereum";

  try {
    const lifiIntegratorId = process.env.LIFI_INTEGRATOR_ID;
    if (!lifiIntegratorId || lifiIntegratorId.startsWith("YOUR_") || lifiIntegratorId === "your_lifi_integrator_id_here") {
      throw new Error("no_lifi");
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

    const chainId = chainMap[targetChain] || 1;
    const tokens = TOKEN_ADDRESSES[targetChain] || TOKEN_ADDRESSES.ethereum;
    const tokenAddr = tokens[asset.toUpperCase()] || tokens.USDC;

    const res = await fetch(LIFI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromChain: chainId,
        toChain: chainId,
        fromToken: tokenAddr,
        toToken: tokens.WETH || tokens.ETH,
        fromAmount: String(Math.round(numAmount * 1e6)),
        options: {
          slippage: parseFloat(slippageTolerance || "0.5") / 100,
          integrator: lifiIntegratorId,
        },
      }),
    });

    if (res.ok) {
      const lifiData = await res.json();
      const estimate = lifiData?.estimate;
      const gasCosts = lifiData?.gasCosts;
      const feeCosts = lifiData?.feeCosts;

      const gasEstimate =
        Array.isArray(gasCosts) && gasCosts.length > 0
          ? `$${((Number(gasCosts[0].amount || "0") / 1e18) * ethPrice).toFixed(2)}`
          : "~$2.80";

      const feeAmount =
        Array.isArray(feeCosts) && feeCosts.length > 0
          ? `$${(Number(feeCosts[0].amount || "0") / 1e6).toFixed(2)}`
          : "$0.00";

      return {
        action,
        asset,
        amount_in: amount,
        expected_amount_out: estimate
          ? (Number(estimate.toAmount) / 1e6).toFixed(2)
          : isDeposit
            ? (numAmount * 1.045).toFixed(2)
            : (numAmount * 0.99).toFixed(2),
        estimated_apy: isDeposit ? "4.5%" : "N/A",
        gas_estimate: gasEstimate,
        slippage: "< 0.01%",
        fee: feeAmount,
        price_impact: lifiData?.priceImpact
          ? `${(Number(lifiData.priceImpact) * 100).toFixed(3)}%`
          : "< 0.05%",
        valid_for_seconds: 30,
        source: "li.fi",
        chain: targetChain,
        protocol: "Aave V3",
        requires_approval: true,
      };
    }
  } catch {}

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
    protocol: poolAddress ? "Aave V3" : "Unknown",
    requires_approval: true,
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
    oracle_risk?: { score: number; level: string; details: string };
  };
  recommendations: string[];
  warnings: string[];
}

export async function analyzeRisk(
  positions: Array<Record<string, unknown>> | undefined,
  timeHorizon?: string,
  includeOracleRisk?: boolean,
  _checkOnchain?: boolean,
): Promise<RiskAnalysis> {
  const posList = positions ?? [];
  const positionCount = posList.length;

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

  const protocols = new Set(
    posList.map((p) => String(p.protocol || "").split(" ")[0].toLowerCase()),
  );
  const uniqueProtocols = protocols.size;
  const concentration =
    positionCount === 1
      ? "high"
      : positionCount <= 3 || uniqueProtocols <= 2
        ? "medium"
        : "low";

  const knownAuditedProtocols = new Set(["aave", "compound", "lido", "rocket", "morpho", "spark", "venus"]);
  const auditedCount = posList.filter((p) =>
    knownAuditedProtocols.has(String(p.protocol || "").toLowerCase().split(" ")[0]),
  ).length;
  const auditScore = positionCount > 0 ? Math.round((auditedCount / positionCount) * 100) : 50;

  const ilScore = hasLP ? 55 : 92;
  const liqScore = hasLeverage ? 45 : hasLP ? 65 : 82;
  const concScore =
    concentration === "high"
      ? 40
      : concentration === "medium"
        ? 62
        : 82;
  const marketScore = hasStablecoinOnly ? 78 : 60;
  
  const oracleScore = includeOracleRisk
    ? hasLP ? 65 : protocols.has("aave") || protocols.has("compound") ? 85 : 70
    : undefined;

  const scores = [auditScore, ilScore, liqScore, concScore, marketScore];
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
  if (auditScore < 80) {
    recommendations.push(
      "Some positions use less-audited protocols — prioritize established protocols like Aave or Compound for larger allocations",
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
  if (recommendations.length === 0) {
    recommendations.push(
      "Portfolio looks well-diversified. Continue monitoring APY changes weekly.",
    );
  }

  const breakdown: RiskAnalysis["breakdown"] = {
    smart_contract_risk: {
      score: auditScore,
      level: auditScore >= 80 ? "Low" : auditScore >= 60 ? "Medium" : "Elevated",
      details:
        auditedCount === positionCount && positionCount > 0
          ? "All positions use well-audited protocols"
          : positionCount > 0
            ? `${auditedCount}/${positionCount} positions use audited protocols`
            : "No positions to analyze",
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
  };

  if (includeOracleRisk && oracleScore !== undefined) {
    breakdown.oracle_risk = {
      score: oracleScore,
      level: oracleScore >= 80 ? "Low" : oracleScore >= 60 ? "Medium" : "Elevated",
      details: protocols.has("aave") || protocols.has("compound")
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
    });
    
    if (res.ok) {
      const json = await res.json();
      const coinData = json?.coins?.[tokenId];
      
      if (coinData?.price) {
        return {
          token: token.toUpperCase(),
          price: coinData.price,
          change_24h: coinData.price_24h_change ?? null,
          market_cap: null,
          source: "defillama",
        };
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
  try {
    const res = await fetch(DEFILLAMA_PROTOCOLS_URL, {
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const protocols: LlamaProtocol[] = await res.json();
      const lower = protocol.toLowerCase();
      const match = protocols.find((p) => 
        p.name?.toLowerCase() === lower ||
        p.slug?.toLowerCase() === lower
      );

      if (match) {
        const auditors = includeAudits ? (match.audits || []).map((a) => a.auditor || a.name).filter(Boolean) : [];
        
        return {
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
          risk_score: match.tvl > 1e9 ? 85 : match.tvl > 1e8 ? 70 : 55,
        };
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

    return {
      token: token.toUpperCase(),
      balance: formatted.toFixed(decimals === 6 ? 2 : 4),
      balance_raw: balance.toString(),
      decimals,
      chain,
      token_address: tokenAddress,
      usd_value: usdValue,
    };
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
  gas_estimate: string;
  gas_cost_usd: string;
  description: string;
  protocol: string;
  action: "approve" | "deposit" | "withdraw";
  asset: string;
  amount: string;
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

export async function prepareDeposit(
  protocol: string,
  asset: string,
  amount: string,
  chain: string,
  walletAddress: string,
): Promise<DepositPreparation> {
  const chainLower = chain.toLowerCase();
  const assetUpper = asset.toUpperCase();
  const decimals = TOKEN_DECIMALS[assetUpper] || 18;
  const amountRaw = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals));
  
  const protocolLower = protocol.toLowerCase();
  let txData: TransactionData;
  let spender: string;
  let estimatedApy = "4.5%";
  let riskLevel = "medium";

  if (protocolLower.includes("aave")) {
    const poolAddress = AAVE_V3_POOL_ADDRESSES[chainLower];
    if (!poolAddress) {
      throw new Error(`Aave V3 not deployed on ${chain}`);
    }
    
    const tokenAddress = TOKEN_ADDRESSES[chainLower]?.[assetUpper];
    if (!tokenAddress) {
      throw new Error(`Token ${asset} not found on ${chain}`);
    }

    const data = encodeTxData(AAVE_POOL_ABI, "supply", [
      tokenAddress,
      amountRaw,
      walletAddress,
      0,
    ]);
    
    const gasEstimate = await getGasEstimate(chainLower, "deposit");
    const ethPrice = await getEthPrice();
    const gasCostEth = (gasEstimate.gas_price_gwei * 200000) / 1e9;
    
    txData = {
      to: poolAddress as `0x${string}`,
      data,
      value: BigInt(0),
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

    const data = encodeTxData(COMPOUND_COMET_ABI, "supply", [
      tokenAddress,
      amountRaw,
    ]);
    
    const gasEstimate = await getGasEstimate(chainLower, "deposit");
    const ethPrice = await getEthPrice();
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
    throw new Error(`Unsupported protocol: ${protocol}`);
  }

  const allowance = await checkAllowance(chainLower, asset, walletAddress, spender);
  let approvalTx: TransactionData | undefined;
  
  if (allowance.needs_approval) {
    approvalTx = await prepareApproval(chainLower, asset, spender);
  }

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
  protocol: string;
  chain: string;
  asset: string;
  amount: string;
  withdraw_all: boolean;
  current_value_usd: string;
}

export async function prepareWithdraw(
  positionId: string,
  amount: string,
  walletAddress: string,
): Promise<WithdrawPreparation> {
  const [protocol, chain, asset] = positionId.toLowerCase().split("-");
  const assetUpper = asset.toUpperCase();
  const decimals = TOKEN_DECIMALS[assetUpper] || 18;
  const withdrawAll = amount.toLowerCase() === "max";
  const amountRaw = withdrawAll
    ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
    : BigInt(Math.floor(parseFloat(amount) * 10 ** decimals));

  let txData: TransactionData;
  let currentValueUsd = "$0.00";

  if (protocol.includes("aave")) {
    const poolAddress = AAVE_V3_POOL_ADDRESSES[chain];
    const tokenAddress = TOKEN_ADDRESSES[chain]?.[assetUpper];
    
    if (!poolAddress || !tokenAddress) {
      throw new Error(`Invalid position or chain for withdrawal`);
    }

    const data = encodeTxData(AAVE_POOL_ABI, "withdraw", [
      tokenAddress,
      amountRaw,
      walletAddress,
    ]);
    
    const gasEstimate = await getGasEstimate(chain, "withdraw");
    const ethPrice = await getEthPrice();
    const gasCostEth = (gasEstimate.gas_price_gwei * 150000) / 1e9;

    const positions = await getPositions(walletAddress, ["aave"], chain);
    const position = positions.positions.find(
      (p) => p.position_id.toLowerCase() === positionId.toLowerCase()
    );
    if (position) {
      currentValueUsd = position.current_value;
    }
    
    txData = {
      to: poolAddress as `0x${string}`,
      data,
      value: BigInt(0),
      chain_id: CHAIN_IDS[chain] || 1,
      gas_estimate: "~150,000 gas",
      gas_cost_usd: `$${(gasCostEth * ethPrice).toFixed(2)}`,
      description: withdrawAll 
        ? `Withdraw all ${asset} from Aave V3`
        : `Withdraw ${amount} ${asset} from Aave V3`,
      protocol: "Aave V3",
      action: "withdraw",
      asset: assetUpper,
      amount: withdrawAll ? "all" : amount,
    };
  } else if (protocol.includes("compound")) {
    const cometAddress = COMPOUND_V3_COMET_ADDRESSES[chain]?.[assetUpper];
    const tokenAddress = TOKEN_ADDRESSES[chain]?.[assetUpper];
    
    if (!cometAddress || !tokenAddress) {
      throw new Error(`Invalid position or chain for withdrawal`);
    }

    const data = encodeTxData(COMPOUND_COMET_ABI, "withdraw", [
      tokenAddress,
      amountRaw,
    ]);
    
    const gasEstimate = await getGasEstimate(chain, "withdraw");
    const ethPrice = await getEthPrice();
    const gasCostEth = (gasEstimate.gas_price_gwei * 120000) / 1e9;

    txData = {
      to: cometAddress as `0x${string}`,
      data,
      value: BigInt(0),
      chain_id: CHAIN_IDS[chain] || 1,
      gas_estimate: "~120,000 gas",
      gas_cost_usd: `$${(gasCostEth * ethPrice).toFixed(2)}`,
      description: withdrawAll
        ? `Withdraw all ${asset} from Compound V3`
        : `Withdraw ${amount} ${asset} from Compound V3`,
      protocol: "Compound V3",
      action: "withdraw",
      asset: assetUpper,
      amount: withdrawAll ? "all" : amount,
    };
  } else {
    throw new Error(`Unsupported protocol for withdrawal: ${protocol}`);
  }

  return {
    transaction: txData,
    protocol: txData.protocol,
    chain,
    asset: assetUpper,
    amount: withdrawAll ? "all" : amount,
    withdraw_all: withdrawAll,
    current_value_usd: currentValueUsd,
  };
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
    const preparation = await prepareDeposit(protocol, asset, amount, chain, walletAddress);
    
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
