const DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools";
const DEFILLAMA_PRICES_URL = "https://coins.llama.fi/prices/current/";
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
};

const CHAIN_TO_LLAMA: Record<string, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  base: "Base",
  polygon: "Polygon",
  avalanche: "Avalanche",
};

const LLAMA_TO_CHAIN: Record<string, string> = Object.fromEntries(
  Object.entries(CHAIN_TO_LLAMA).map(([k, v]) => [v, k]),
);

const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  ethereum: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  },
  arbitrum: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  },
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH: "0x4200000000000000000000000000000000000006",
  },
  optimism: {
    USDC: "0x0b2C639c533813f4Aa9D1143dca80b6d284B6Ca0",
    WETH: "0x4200000000000000000000000000000000000006",
  },
  polygon: {
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  },
};

let cachedEthPrice: number | null = null;
let ethPriceTimestamp = 0;

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
}

export async function discoverOpportunities(
  chain?: string,
  minApy?: number,
  maxRisk?: string,
  protocol?: string,
): Promise<{ opportunities: Opportunity[] }> {
  const res = await fetch(DEFILLAMA_YIELDS_URL, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`DeFi Llama yields failed: ${res.status}`);

  const { data } = await res.json();
  let pools = data;

  if (chain) {
    const llamaChain = CHAIN_TO_LLAMA[chain.toLowerCase()];
    if (llamaChain) pools = pools.filter((p: any) => p.chain === llamaChain);
  }

  if (protocol) {
    const lower = protocol.toLowerCase();
    pools = pools.filter((p: any) =>
      (p.protocol || "").toLowerCase().includes(lower),
    );
  }

  if (minApy !== undefined) {
    pools = pools.filter((p: any) => (p.apy ?? 0) >= minApy);
  }

  pools = pools.sort((a: any, b: any) => (b.apy ?? 0) - (a.apy ?? 0));

  if (maxRisk) {
    const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
    const maxLevel = riskOrder[maxRisk] ?? 2;
    pools = pools.filter(
      (p: any) => (assessRiskLevel(p) as unknown as number) <= maxLevel,
    );
  }

  const opportunities: Opportunity[] = pools.slice(0, 20).map((pool: any) => ({
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
  }));

  return { opportunities };
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

async function getEthBalanceOnChain(
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
}

async function getAavePositions(
  walletAddress: string,
): Promise<AavePosition[]> {
  const allPositions: AavePosition[] = [];

  await Promise.allSettled(
    Object.entries(AAVE_V3_SUBGRAPHS).map(async ([chain, url]) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              query($user: Bytes!) {
                portfolios(where: { user: $user }) {
                  id
                }
                userReserves(
                  where: { user: $user, currentTotalDebt_gt: 0, currentATokenBalance_gt: 0 }
                  orderBy: currentATokenBalance
                  orderDirection: desc
                  first: 10
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
          if (symbol === "WETH" || symbol === "ETH" || symbol === "wstETH") {
            valueUsd = formattedBal * ethPrice;
          } else {
            valueUsd = formattedBal;
          }

          const apy = Number(r.reserve?.liquidityRate ?? 0) * 100;

          allPositions.push({
            protocol: `Aave V3 (${chain.charAt(0).toUpperCase() + chain.slice(1)})`,
            pool: `${symbol} Pool`,
            chain,
            asset: `a${symbol}`,
            deposited: `${formattedBal.toFixed(4)} ${symbol}`,
            current_value: `$${valueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            unrealized_pnl: "Active position",
            entry_apy: `${apy.toFixed(1)}%`,
            time_weighted_return: "$0.00",
            days_active: r.timestamp
              ? Math.floor((Date.now() / 1000 - Number(r.timestamp)) / 86400)
              : 0,
          });
        }
      } catch {}
    }),
  );

  return allPositions;
}

export interface PositionData {
  wallet_address: string;
  total_value: string;
  positions: AavePosition[];
}

export async function getPositions(
  walletAddress: string,
  _protocolFilter?: string,
  _chainFilter?: string,
): Promise<PositionData> {
  const [aavePositions] = await Promise.allSettled([
    getAavePositions(walletAddress),
  ]);

  const positions =
    aavePositions.status === "fulfilled" ? aavePositions.value : [];

  const totalValue = positions.reduce((sum, p) => {
    const match = p.current_value.match(/\$?([\d,.]+)/);
    const val = match ? parseFloat(match[1].replace(/,/g, "")) : 0;
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  return {
    wallet_address: walletAddress.toLowerCase(),
    total_value: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    positions,
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
}

export async function getQuote(
  action: string,
  _amount: string,
  asset: string,
  _poolAddress: string,
  _slippageTolerance?: string,
): Promise<QuoteData> {
  const ethPrice = await getEthPrice();

  const numAmount = parseFloat(_amount) || 0;
  const isDeposit = action === "deposit";

  try {
    const lifiIntegratorId = process.env.LIFI_INTEGRATOR_ID;
    if (!lifiIntegratorId || lifiIntegratorId.startsWith("YOUR_")) {
      throw new Error("no_lifi");
    }

    const chainMap: Record<string, number> = {
      ethereum: 1,
      arbitrum: 42161,
      optimism: 10,
      base: 8453,
      polygon: 137,
    };

    const tokenAddrMap: Record<string, Record<string, string>> = {
      ethereum: {
        USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeeeeeeeE",
        WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      },
      arbitrum: {
        USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeeeeeeeE",
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      },
      base: {
        USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeeeeeeeE",
        WETH: "0x4200000000000000000000000000000000000006",
      },
    };

    const targetChain = "ethereum";
    const chainId = chainMap[targetChain] || 1;
    const tokens = tokenAddrMap[targetChain] || tokenAddrMap.ethereum;
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
          slippage: parseFloat(_slippageTolerance || "0.5") / 100,
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
        amount_in: _amount,
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
      };
    }
  } catch {}

  const feeRate = 0.001;
  const fee = (numAmount * feeRate).toFixed(2);

  return {
    action,
    asset,
    amount_in: _amount,
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
  };
  recommendations: string[];
}

export async function analyzeRisk(
  positions: Array<Record<string, unknown>> | undefined,
  timeHorizon?: string,
): Promise<RiskAnalysis> {
  const posList = positions ?? [];
  const positionCount = posList.length;

  const hasLP = posList.some((p) =>
    /lp|pool|[-\/]/i.test(String(p.asset || p.protocol || "")),
  );
  const hasStablecoinOnly = posList.every((p) =>
    /usdc|usdt|dai|usd/i.test(String(p.asset || "")),
  );

  const protocols = new Set(
    posList.map((p) => String(p.protocol || "").split(" ")[0]),
  );
  const uniqueProtocols = protocols.size;
  const concentration =
    positionCount === 1
      ? "high"
      : positionCount <= 3 || uniqueProtocols <= 2
        ? "medium"
        : "low";

  const knownAuditedProtocols = new Set(["aave", "compound", "lido", "rocket", "morpho"]);
  const auditedCount = posList.filter((p) =>
    knownAuditedProtocols.has(String(p.protocol || "").toLowerCase()),
  ).length;
  const auditScore = positionCount > 0 ? Math.round((auditedCount / positionCount) * 100) : 50;

  const ilScore = hasLP ? 55 : 92;
  const liqScore = hasLP ? 65 : 82;
  const concScore =
    concentration === "high"
      ? 40
      : concentration === "medium"
        ? 62
        : 82;
  const marketScore = hasStablecoinOnly ? 78 : 60;

  const scores = [auditScore, ilScore, liqScore, concScore, marketScore];
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const horizonLabels: Record<string, string> = {
    short: "Short-term (< 1 week)",
    medium: "Medium-term (< 3 months)",
    long: "Long-term (> 3 months)",
  };

  const recommendations: string[] = [];

  if (concentration === "high") {
    recommendations.push(
      "Consider diversifying across additional protocols to reduce single-point-of-failure risk",
    );
  }
  if (hasLP) {
    recommendations.push(
      "LP positions are exposed to impermanent loss — monitor price ratios between paired assets",
    );
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
    recommendations.push(
      "Short time horizon with LP exposure increases impermanent loss risk — consider stablecoin lending instead",
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Portfolio looks well-diversified. Continue monitoring APY changes weekly.",
    );
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
    breakdown: {
      smart_contract_risk: {
        score: auditScore,
        level: auditScore >= 80 ? "Low" : auditScore >= 60 ? "Medium" : "Elevated",
        details:
          auditedCount === positionCount
            ? "All positions use well-audited protocols"
            : `${auditedCount}/${positionCount} positions use audited protocols`,
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
        details: hasLP
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
    },
    recommendations,
  };
}
