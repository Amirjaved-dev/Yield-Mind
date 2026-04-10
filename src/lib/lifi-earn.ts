const LIFI_BASE = "https://api.li.fi/v1";

function getIntegratorId(): string {
  const id = process.env.LIFI_INTEGRATOR_ID;
  if (!id || id.startsWith("YOUR_") || id === "your_lifi_integrator_id_here") {
    throw new Error("LIFI_INTEGRATOR_ID not configured");
  }
  return id;
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
  opportunityId: string;
  fromToken: string;
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
}

export interface LifiPosition {
  id: string;
  opportunityId: string;
  protocol: string;
  chainId: number;
  chainName: string;
  tokenSymbol: string;
  depositedAmount: string;
  depositedAmountUsd: string;
  currentApy: number;
  entryTime: string;
  status: "active" | "withdrawn" | "pending";
}

export async function lifiDiscoverOpportunities(params?: {
  chainId?: number;
  tokenSymbol?: string;
  minApy?: number;
  limit?: number;
}): Promise<{ opportunities: LifiOpportunity[]; totalCount: number }> {
  const integratorId = getIntegratorId();

  const searchParams = new URLSearchParams({
    integratorId,
  });

  if (params?.chainId) searchParams.set("chainId", String(params.chainId));
  if (params?.tokenSymbol) searchParams.set("tokenSymbol", params.tokenSymbol);
  if (params?.minApy) searchParams.set("minApy", String(params.minApy));
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const res = await fetch(`${LIFI_BASE}/opportunities?${searchParams.toString()}`, {
    headers: {
      Accept: "application/json",
      "x-lifi-integrator": integratorId,
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`LI.FI opportunities error: ${res.status}`);
  }

  const json = await res.json();
  const rawOpps: Record<string, unknown>[] = json.opportunities || json.data || [];

  const opportunities: LifiOpportunity[] = rawOpps.map((opp: Record<string, unknown>) => ({
    id: (opp.id as string) || "",
    name: (opp.name as string) || (opp.protocol as string) || "Unknown Vault",
    protocol: (opp.protocol as string) || "Unknown",
    chainId: opp.chainId as number || 1,
    chainName: (opp.chainName as string) || "Ethereum",
    tokenAddress: (opp.tokenAddress as string) || (opp.asset as string) || "",
    tokenSymbol: (opp.tokenSymbol as string) || (opp.symbol as string) || "Unknown",
    tokenDecimals: (opp.tokenDecimals as number) || 18,
    apy: (opp.apy as number) ?? 0,
    tvlUsd: (opp.tvlUsd as number) || (opp.tvl as number) || 0,
    riskLevel: ((opp.riskLevel as string) || "medium").toLowerCase() as LifiOpportunity["riskLevel"],
    tags: opp.tags as string[] | undefined,
  }));

  return {
    opportunities,
    totalCount: json.totalCount || opportunities.length,
  };
}

export async function lifiGetQuote(request: LifiQuoteRequest): Promise<LifiQuoteResponse> {
  const integratorId = getIntegratorId();

  const res = await fetch(`${LIFI_BASE}/earn/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-lifi-integrator": integratorId,
    },
    body: JSON.stringify({
      ...request,
      integratorId,
      slippage: request.slippage ?? 0.005,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LI.FI quote error ${res.status}: ${errText}`);
  }

  return res.json();
}

export async function lifiGetPositions(walletAddress: string): Promise<{
  positions: LifiPosition[];
  totalValueUsd: string;
}> {
  const integratorId = getIntegratorId();

  const searchParams = new URLSearchParams({
    walletAddress: walletAddress.toLowerCase(),
    integratorId,
  });

  const res = await fetch(`${LIFI_BASE}/positions?${searchParams.toString()}`, {
    headers: {
      Accept: "application/json",
      "x-lifi-integrator": integratorId,
    },
  });

  if (!res.ok) {
    throw new Error(`LI.FI positions error: ${res.status}`);
  }

  const json = await res.json();
  const rawPositions: Record<string, unknown>[] = json.positions || [];

  const positions: LifiPosition[] = rawPositions.map((pos: Record<string, unknown>) => ({
    id: (pos.id as string) || "",
    opportunityId: (pos.opportunityId as string) || "",
    protocol: (pos.protocol as string) || "Unknown",
    chainId: pos.chainId as number || 1,
    chainName: (pos.chainName as string) || "Ethereum",
    tokenSymbol: (pos.tokenSymbol as string) || (pos.symbol as string) || "Unknown",
    depositedAmount: (pos.depositedAmount as string) || (pos.amount as string) || "0",
    depositedAmountUsd: (pos.depositedAmountUsd as string) || (pos.amountUsd as string) || "$0.00",
    currentApy: (pos.currentApy as number) || (pos.apy as number) || 0,
    entryTime: (pos.entryTime as string) || new Date().toISOString(),
    status: ((pos.status as string) || "active").toLowerCase() as LifiPosition["status"],
  }));

  return {
    positions,
    totalValueUsd: json.totalValueUsd || "$0.00",
  };
}
