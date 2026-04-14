import { NextRequest } from "next/server";

const LIFI_EARN_BASE = "https://earn.li.fi/v1";
const LIFI_COMPOSER_BASE = "https://li.quest/v1";

function buildForwardUrl(path: string, searchParams: URLSearchParams, body?: Record<string, unknown>): string {
  if (path === "quote") {
    const fromChain = String(
      body?.chainId ??
        body?.fromChainId ??
        searchParams.get("chainId") ??
        searchParams.get("fromChainId") ??
        body?.fromChain ??
        searchParams.get("fromChain") ??
        "8453",
    );
    const toChain = String(
      body?.destinationChainId ??
        body?.toChainId ??
        searchParams.get("destinationChainId") ??
        searchParams.get("toChainId") ??
        body?.toChain ??
        searchParams.get("toChain") ??
        "8453",
    );
    const fromAddress = String(body?.walletAddress ?? body?.fromAddress ?? searchParams.get("fromAddress") ?? "");
    const toToken = String(body?.toToken ?? body?.opportunityId ?? searchParams.get("toToken") ?? "");
    const fromToken = String(body?.fromToken ?? searchParams.get("fromToken") ?? "");
    const amount = String(body?.amount ?? body?.fromAmount ?? searchParams.get("fromAmount") ?? "");

    const quoteParams = new URLSearchParams({
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount: amount,
    });

    if (fromAddress) {
      quoteParams.set("fromAddress", fromAddress);
      quoteParams.set("toAddress", fromAddress);
    }

    if (body?.slippage !== undefined) {
      quoteParams.set("slippage", String(body.slippage));
    }

    return `${LIFI_COMPOSER_BASE}/quote?${quoteParams.toString()}`;
  }

  if (path === "status") {
    return `${LIFI_COMPOSER_BASE}/status?${searchParams.toString()}`;
  }

  if (path === "positions") {
    const walletAddress = searchParams.get("walletAddress") || String(body?.walletAddress ?? "");
    return `${LIFI_EARN_BASE}/earn/portfolio/${walletAddress}/positions`;
  }

  const earnPath = path === "opportunities" ? "earn/vaults" : path.startsWith("earn/") ? path : `earn/${path}`;
  return `${LIFI_EARN_BASE}/${earnPath}?${searchParams.toString()}`;
}

async function proxyToLifi(req: NextRequest, method: "GET" | "POST") {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") || "opportunities";
  const integratorId = process.env.LIFI_INTEGRATOR_ID;

  if (!integratorId || integratorId.startsWith("YOUR_") || integratorId === "your_lifi_integrator_id_here") {
    return Response.json({ error: "LIFI_INTEGRATOR_ID not configured" }, { status: 500 });
  }

  const forwardParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== "path") forwardParams.append(key, value);
  });

  const body = method === "POST" ? (await req.json().catch(() => null)) : null;
  const upstreamUrl = buildForwardUrl(path, forwardParams, body ?? undefined);
  const headers: Record<string, string> = {
    "x-lifi-integrator": integratorId,
    "x-lifi-api-key": integratorId,
    Accept: "application/json",
  };

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers,
  });

  const contentType = upstream.headers.get("content-type") || "application/json";

  if (contentType.includes("application/json")) {
    const data = await upstream.json();
    return Response.json(data, { status: upstream.status });
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
}

export async function GET(req: NextRequest) {
  return proxyToLifi(req, "GET");
}

export async function POST(req: NextRequest) {
  return proxyToLifi(req, "POST");
}
