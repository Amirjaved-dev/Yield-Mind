const LIFI_PROXY_BASE = "/api/lifi-proxy";

function getAppOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

function buildProxyUrl(path: string, params?: URLSearchParams): string {
  const url = new URL(LIFI_PROXY_BASE, getAppOrigin());
  url.searchParams.set("path", path);
  params?.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

export function isLifiConfigured(): boolean {
  const id = process.env.LIFI_INTEGRATOR_ID;
  return !!(id && !id.startsWith("YOUR_") && id !== "your_lifi_integrator_id_here");
}

export function isLifiBackendEnabled(): boolean {
  return isLifiConfigured();
}

function getIntegratorId(): string {
  const id = process.env.LIFI_INTEGRATOR_ID;
  if (!id || id.startsWith("YOUR_") || id === "your_lifi_integrator_id_here") {
    throw new Error("LIFI_INTEGRATOR_ID not configured");
  }
  return id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface LifiOpportunity {
  id: string;
  name: string;
  protocol: string;
  chainId: number;
  chainName: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  apy: number;
  tvlUsd: number;
  riskLevel: "low" | "medium" | "high";
  tags?: string[];
}

export interface LifiQuoteRequest {
  chainId: number;
  destinationChainId?: number;
  opportunityId?: string;
  fromToken: string;
  toToken?: string;
  amount: string;
  slippage?: number;
  walletAddress?: string;
}

export interface LifiQuoteResponse {
  transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
    gasPrice?: string;
  };
  approval?: {
    to: string;
    data: string;
    value: string;
    tokenAddress: string;
    spender: string;
    amount: string;
  };
  expectedApy: number;
  fee?: {
    amount: string;
    token: string;
    usdValue: string;
  };
  estimatedGasCostUsd?: string;
  priceImpact?: string;
  validForSeconds: number;
  opportunity: {
    id: string;
    protocol: string;
    apy: number;
  };
  fromChainId: number;
  toChainId: number;
  tool?: string;
}

export interface LifiStatusResponse {
  status: string;
  substatus?: string;
  substatusMessage?: string;
  transactionId?: string;
  lifiExplorerLink?: string;
  sending?: {
    txHash?: string;
  };
  receiving?: {
    txHash?: string;
  };
  tool?: string;
}

export interface LifiPosition {
  id: string;
  opportunityId: string;
  protocol: string;
  chainId: number;
  chainName: string;
  tokenAddress: string;
  tokenDecimals: number;
  tokenSymbol: string;
  depositedAmount: string;
  depositedAmountUsd: string;
  currentApy: number;
  entryTime: string;
  status: "active" | "withdrawn" | "pending";
}

const TRUSTED_PROTOCOLS = [
  "aave", "aave v3", "aave v2",
  "morpho", "morpho vault", "morpho aave", "morpho compound",
  "compound", "compound iii", "comet",
  "euler",
  "pendle",
  "lido", "wsteth", "steth",
  "etherfi", "eeth",
  "hyperlend",
  "seamless",
  "moonwell",
  "venus",
  "spark",
  "yearn",
  "angelo",
  "swaev",
  "yo", "yo protocol",
  "usd0", "usd0++",
  "nile",
  "exactum",
  "flux",
  "odyssey",
  "aerodrome",
  "base swap",
  "mkr", "maker",
  "lybra",
  "grain",
  "benqi",
  "silofinance", "silo",
  "magpie",
  "overnight",
  "usdm", "sdai",
  "easylend",
  "balancer", "convex",
  "bluefin",
  "tinct",
];

const KNOWN_ASSETS = ["USDC", "USDbC", "ETH", "WETH", "WBTC", "DAI", "USDT", "stETH", "wstETH"];

function isLegitimateVault(opp: LifiOpportunity): boolean {
  const symbolUpper = opp.tokenSymbol.toUpperCase().trim();
  const nameLower = (opp.name || "").toLowerCase().trim();

  const isLpPairToken = symbolUpper.includes("-") || /LP$|CBTC|RBI|REI|AITV|CBBTC/i.test(symbolUpper);

  const insaneApy = opp.apy > 500;

  const dustTvl = opp.tvlUsd < 10_000;

  const emptyName = !nameLower || nameLower.length < 2 || /^(unknown|-|\/)$/i.test(nameLower);

  if (isLpPairToken) return false;
  if (insaneApy) return false;
  if (dustTvl) return false;
  if (emptyName) return false;

  return true;
}

export async function lifiDiscoverOpportunities(params?: {
  chainId?: number;
  tokenSymbol?: string;
  minApy?: number;
  limit?: number;
}): Promise<{ opportunities: LifiOpportunity[]; totalCount: number }> {
  if (!isLifiBackendEnabled()) {
    throw new Error("LI.FI backend is disabled");
  }

  if (params?.chainId && params.chainId !== 8453) {
    throw new Error("LI.FI backend is Base-only");
  }

  const searchParams = new URLSearchParams({
    chainId: "8453",
    asset: params?.tokenSymbol || "USDC",
    sortBy: "apy",
  });

  if (params?.limit) searchParams.set("limit", String(params.limit));

  const requestUrl = buildProxyUrl("earn/vaults", searchParams);

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    throw new Error(`LI.FI opportunities unreachable: ${msg}`);
  }

  if (!res.ok) {
    throw new Error(`LI.FI opportunities error: ${res.status}`);
  }

  const json = await res.json();
  const rawOpps: Record<string, unknown>[] = json.data || json.opportunities || [];

  const opportunities: LifiOpportunity[] = rawOpps
    .map((opp: Record<string, unknown>) => {
      const lpToken = Array.isArray(opp.lpTokens) ? (opp.lpTokens[0] as Record<string, unknown> | undefined) : undefined;
      const protocolData = isRecord(opp.protocol) ? opp.protocol : null;
      const analytics = isRecord(opp.analytics) ? opp.analytics : null;
      const apyData = analytics && isRecord(analytics.apy) ? analytics.apy : null;
      const tvlData = analytics && isRecord(analytics.tvl) ? analytics.tvl : null;

      return {
        id: String(lpToken?.address || opp.address || ""),
        name: String(opp.name || protocolData?.name || "Unknown Vault"),
        protocol: String(protocolData?.name || opp.protocol || "Unknown"),
        chainId: Number(opp.chainId || 8453),
        chainName: String(opp.network || "Base"),
        tokenAddress: String(lpToken?.address || opp.address || ""),
        tokenSymbol: String(lpToken?.symbol || opp.asset || "Unknown"),
        tokenDecimals: Number(lpToken?.decimals || 18),
        apy: Number(apyData?.total ?? 0),
        tvlUsd: Number(tvlData?.usd ?? 0),
        riskLevel: "medium" as const,
        tags: Array.isArray(opp.tags) ? (opp.tags as string[]) : undefined,
      };
    })
    .filter(isLegitimateVault);

  const filteredByMinApy = params?.minApy ? opportunities.filter((opp) => opp.apy >= params.minApy!) : opportunities;

  return {
    opportunities: filteredByMinApy,
    totalCount: json.total || json.totalCount || filteredByMinApy.length,
  };
}

export async function lifiGetQuote(request: LifiQuoteRequest): Promise<LifiQuoteResponse> {
  if (!isLifiBackendEnabled()) {
    throw new Error("LI.FI backend is disabled");
  }

  const toChainId = request.destinationChainId ?? 8453;

  if (!request.chainId || !toChainId) {
    throw new Error("LI.FI quote requires source and destination chain IDs");
  }

  const integratorId = getIntegratorId();

  let res: Response;
  try {
    res = await fetch(buildProxyUrl("quote"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        ...request,
        destinationChainId: toChainId,
        integratorId,
        slippage: request.slippage ?? 0.005,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    throw new Error(`LI.FI quote unreachable: ${msg}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LI.FI quote error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const transactionRequest = json.transactionRequest || json.transaction || {};
  const estimate = json.estimate || {};
  const protocol = json.protocol || json.opportunity?.protocol || "Unknown";

  return {
    transaction: {
      to: transactionRequest.to || transactionRequest.target || "",
      data: transactionRequest.data || "0x",
      value: transactionRequest.value || "0",
      gasLimit: transactionRequest.gasLimit,
      gasPrice: transactionRequest.gasPrice,
    },
    approval: estimate.approvalAddress
      ? {
          to: estimate.approvalAddress,
          data: "0x",
          value: "0",
          tokenAddress: request.fromToken,
          spender: estimate.approvalAddress,
          amount: request.amount,
        }
      : undefined,
    expectedApy: Number(json.expectedApy ?? estimate.expectedApy ?? 0),
    fee: json.fee
      ? {
          amount: String(json.fee.amount ?? "0"),
          token: String(json.fee.token ?? ""),
          usdValue: String(json.fee.usdValue ?? "0"),
        }
      : undefined,
    estimatedGasCostUsd: estimate.gasCostUsd || estimate.estimatedGasCostUsd || json.estimatedGasCostUsd,
    priceImpact: estimate.priceImpact || json.priceImpact,
    validForSeconds: Number(json.validForSeconds ?? estimate.validForSeconds ?? 30),
    opportunity: {
      id: request.opportunityId ?? request.toToken ?? "",
      protocol,
      apy: Number(json.expectedApy ?? estimate.expectedApy ?? 0),
    },
    fromChainId: request.chainId,
    toChainId,
    tool: typeof json.tool === "string" ? json.tool : undefined,
  };
}

export async function lifiGetStatus(params: {
  txHash: string;
  fromChainId?: number;
  toChainId?: number;
}): Promise<LifiStatusResponse> {
  if (!isLifiBackendEnabled()) {
    throw new Error("LI.FI backend is disabled");
  }

  getIntegratorId();

  const searchParams = new URLSearchParams({ txHash: params.txHash });
  if (params.fromChainId) searchParams.set("fromChain", String(params.fromChainId));
  if (params.toChainId) searchParams.set("toChain", String(params.toChainId));

  let res: Response;
  try {
    res = await fetch(buildProxyUrl("status", searchParams), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    throw new Error(`LI.FI status unreachable: ${msg}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LI.FI status error ${res.status}: ${errText}`);
  }

  return await res.json();
}

export async function lifiGetPositions(walletAddress: string): Promise<{
  positions: LifiPosition[];
  totalValueUsd: string;
}> {
  if (!isLifiBackendEnabled()) {
    throw new Error("LI.FI backend is disabled");
  }

  getIntegratorId();

  const requestUrl = buildProxyUrl(`earn/portfolio/${encodeURIComponent(walletAddress.toLowerCase())}/positions`);

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    throw new Error(`LI.FI positions unreachable: ${msg}`);
  }

  if (!res.ok) {
    throw new Error(`LI.FI positions error: ${res.status}`);
  }

  const json = await res.json();
  const rawPositions: Record<string, unknown>[] = json.positions || [];

  const positions: LifiPosition[] = rawPositions.map((pos: Record<string, unknown>) => ({
    id: `${String(pos.chainId || "0")}:${String(pos.protocolName || "unknown")}:${String(pos.asset && isRecord(pos.asset) ? pos.asset.symbol : pos.id || "position")}`,
    opportunityId: String(pos.asset && isRecord(pos.asset) ? pos.asset.address || "" : ""),
    protocol: String(pos.protocolName || "Unknown"),
    chainId: Number(pos.chainId || 1),
    chainName: String(pos.chainId === 8453 ? "Base" : pos.chainId === 1 ? "Ethereum" : "Unknown"),
    tokenAddress: String(pos.asset && isRecord(pos.asset) ? pos.asset.address || "" : ""),
    tokenDecimals: Number(pos.asset && isRecord(pos.asset) ? pos.asset.decimals || 18 : 18),
    tokenSymbol: String(pos.asset && isRecord(pos.asset) ? pos.asset.symbol || "Unknown" : pos.symbol || "Unknown"),
    depositedAmount: String(pos.balanceNative || pos.amount || "0"),
    depositedAmountUsd: String(pos.balanceUsd || pos.amountUsd || "$0.00"),
    currentApy: Number(pos.currentApy || pos.apy || 0),
    entryTime: new Date().toISOString(),
    status: "active",
  }));

  return {
    positions,
    totalValueUsd: positions
      .reduce((sum, position) => sum + (Number.parseFloat(position.depositedAmountUsd.replace(/[^0-9.\-]/g, "")) || 0), 0)
      .toFixed(2),
  };
}
