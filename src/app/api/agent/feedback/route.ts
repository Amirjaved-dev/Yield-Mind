import { NextRequest } from "next/server";
import { updateState } from "@/lib/agent-state";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet_address, tx_type, status, tx_hash, protocol, asset, amount, error } = body;

    if (!wallet_address || !tx_type || !status) {
      return Response.json({ error: "Missing required fields: wallet_address, tx_type, status" }, { status: 400 });
    }

    const validStatuses = ["pending", "success", "failed"];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    const validTypes = ["deposit", "withdraw"];
    if (!validTypes.includes(tx_type)) {
      return Response.json({ error: `Invalid tx_type: ${tx_type}` }, { status: 400 });
    }

    updateState(wallet_address, {
      phase: status === "success" ? "completed" : status === "pending" ? "executing" : "idle",
      lastTransaction: {
        type: tx_type,
        status: status as "pending" | "success" | "failed",
        tx_hash,
        protocol,
        asset,
        amount,
        error,
        timestamp: Date.now(),
      },
      selectedOpportunity: status === "success" ? null : undefined,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
