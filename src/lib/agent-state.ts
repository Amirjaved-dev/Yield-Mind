export type AgentPhase = "idle" | "discovery" | "comparison" | "ready" | "executing" | "completed";

export type ConversationState = {
  phase: AgentPhase;
  walletAddress: string;
  chain: string;
  selectedOpportunity: {
    protocol: string;
    asset: string;
    amount: string;
    pool_address: string;
    apy: number;
  } | null;
  lastDiscovery: {
    asset?: string;
    timestamp: number;
    result_count: number;
  } | null;
  lastPositions: {
    timestamp: number;
    position_count: number;
  } | null;
  lastTransaction: {
    type: "deposit" | "withdraw";
    status: "pending" | "success" | "failed";
    tx_hash?: string;
    protocol?: string;
    asset?: string;
    amount?: string;
    error?: string;
    timestamp: number;
  } | null;
  turnCount: number;
};

const sessions = new Map<string, ConversationState>();

export function getState(walletAddress: string): ConversationState {
  const key = walletAddress.toLowerCase();
  let state = sessions.get(key);
  if (!state) {
    state = {
      phase: "idle",
      walletAddress: key,
      chain: "base",
      selectedOpportunity: null,
      lastDiscovery: null,
      lastPositions: null,
      lastTransaction: null,
      turnCount: 0,
    };
    sessions.set(key, state);
  }
  return state;
}

export function updateState(
  walletAddress: string,
  partial: Partial<ConversationState>,
): ConversationState {
  const state = getState(walletAddress);
  Object.assign(state, partial);
  return state;
}

export function clearState(walletAddress: string): void {
  const key = walletAddress.toLowerCase();
  sessions.delete(key);
}

export function formatStateContext(state: ConversationState): string {
  const parts: string[] = [];

  parts.push(`Current phase: ${state.phase}`);
  parts.push(`Chain: ${state.chain}`);
  parts.push(`Turn: ${state.turnCount}`);

  if (state.selectedOpportunity) {
    const opp = state.selectedOpportunity;
    parts.push(`Selected opportunity: ${opp.protocol} - ${opp.asset} (APY: ${opp.apy}%)`);
  }

  if (state.lastDiscovery) {
    const age = Math.round((Date.now() - state.lastDiscovery.timestamp) / 1000);
    parts.push(`Last discovery: ${state.lastDiscovery.result_count} opportunities (${age}s ago)`);
  }

  if (state.lastPositions) {
    const age = Math.round((Date.now() - state.lastPositions.timestamp) / 1000);
    parts.push(`Last positions check: ${state.lastPositions.position_count} positions (${age}s ago)`);
  }

  if (state.lastTransaction) {
    const tx = state.lastTransaction;
    parts.push(`Last transaction: ${tx.type} ${tx.status}${tx.error ? ` (${tx.error})` : ""}${tx.tx_hash ? ` [${tx.tx_hash.slice(0, 10)}...]` : ""}`);
  }

  return parts.join("\n");
}
