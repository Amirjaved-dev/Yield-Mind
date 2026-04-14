import { NextResponse } from "next/server";
import { isLifiBackendEnabled } from "@/lib/lifi-earn";

export async function GET(req: Request) {
  if (!isLifiBackendEnabled()) {
    return NextResponse.json({ opportunities: [], totalCount: 0 });
  }

  try {
    const params = new URLSearchParams({
      chainId: "8453",
      asset: "USDC",
      sortBy: "apy",
    });

    const proxyUrl = new URL(`/api/lifi-proxy?path=earn/vaults&${params.toString()}`, req.url);
    const res = await fetch(proxyUrl, { headers: { Accept: "application/json" } });

    if (!res.ok) {
      return NextResponse.json(
        { error: `LI.FI API error: ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 },
    );
  }
}
