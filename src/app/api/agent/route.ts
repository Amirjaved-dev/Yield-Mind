import { NextRequest } from "next/server";
import { tools } from "@/lib/agent-tools";
import { buildSystemPrompt } from "@/lib/prompts/system-prompt";
import {
  discoverOpportunities,
  discoverLifiOpportunities,
  getPositions,
  getQuote,
  analyzeRisk,
  getTokenPrice,
  getProtocolInfo,
  getGasEstimate,
  executeDeposit,
  executeWithdraw,
  checkTokenBalance,
  checkAllowance,
  prepareDeposit,
  prepareWithdraw,
  getPortfolioSummary,
  getMarketOverview,
} from "@/lib/defi-data";
import { getState, updateState, formatStateContext } from "@/lib/agent-state";

const MAX_TOOL_ROUNDS = 3;
const MAX_API_RETRIES = 2;
const ZAI_CHAT_COMPLETIONS_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const ZAI_MODEL = "glm-4.5-airx";
const BASE_CHAIN = "base";
const TOOL_TEMP = 0.0;
const FINAL_TEMP = 0.1;
const MAX_FINAL_TOKENS = 1024;

type ToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: ChatMessage;
  }>;
  error?: {
    message?: string;
  } | string;
};

const CASUAL_PROMPT_PATTERN =
  /^(hi|hello|hey|yo|sup|gm|good morning|good afternoon|good evening|how are you|what's up)\b[!.?]*$/i;

const TOOL_LABELS: Record<string, string> = {
  get_portfolio_summary: "Fetching portfolio summary",
  get_market_overview: "Getting market overview",
  check_balance: "Checking token balance",
  check_approval: "Checking approval status",
  discover_opportunities: "Scanning DeFi protocols",
  get_positions: "Fetching positions",
  get_quote: "Getting quote",
  analyze_risk: "Analyzing risk profile",
  get_token_price: "Fetching token price",
  get_protocol_info: "Looking up protocol",
  get_gas_estimate: "Estimating gas costs",
  prepare_deposit: "Preparing deposit",
  prepare_withdraw: "Preparing withdrawal",
  build_transaction_deposit: "Building deposit transaction",
  build_transaction_withdraw: "Building withdrawal transaction",
  execute_deposit: "Building deposit transaction",
  execute_withdraw: "Building withdrawal transaction",
};

const TOOL_ICONS: Record<string, string> = {
  get_portfolio_summary: "wallet",
  get_market_overview: "activity",
  check_balance: "wallet",
  check_approval: "check",
  discover_opportunities: "magnifying-glass",
  get_positions: "wallet",
  get_quote: "calculator",
  analyze_risk: "shield",
  get_token_price: "dollar",
  get_protocol_info: "info",
  get_gas_estimate: "fuel",
  prepare_deposit: "arrow-down",
  prepare_withdraw: "arrow-up",
  build_transaction_deposit: "arrow-down",
  build_transaction_withdraw: "arrow-up",
  execute_deposit: "arrow-down",
  execute_withdraw: "arrow-up",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCasualGreeting(goal: string): boolean {
  return CASUAL_PROMPT_PATTERN.test(goal.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChatCompletionResponse(
  payload: unknown,
): payload is ChatCompletionResponse {
  if (!isRecord(payload)) {
    return false;
  }

  return !("choices" in payload) || Array.isArray(payload.choices);
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const nestedError = payload.error;
  if (typeof nestedError === "string") {
    return nestedError;
  }

  if (isRecord(nestedError) && typeof nestedError.message === "string") {
    return nestedError.message;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return null;
}

function parseToolInput(rawArguments: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawArguments);
    return isRecord(parsed)
      ? parsed
      : { error: "Tool arguments were not a JSON object." };
  } catch {
    return { error: "Tool arguments were not valid JSON." };
  }
}

const INTENT_TOOL_MAP: Array<{ patterns: RegExp[]; toolNames: string[] }> = [
  { patterns: [/yield|apy|earn|interest|best.*return|opportunit/i], toolNames: ["discover_opportunities"] },
  { patterns: [/portfolio|position|holdings|my.*wallet|what.*do i have|my.*asset|where is my/i], toolNames: ["get_portfolio_summary"] },
  { patterns: [/balance|how much/i], toolNames: ["check_balance", "get_token_price"] },
  { patterns: [/deposit|invest|put.*into|send.*to/i], toolNames: ["check_balance", "discover_opportunities", "prepare_deposit", "build_transaction_deposit"] },
  { patterns: [/withdraw|take out|remove|cash out/i], toolNames: ["get_portfolio_summary", "prepare_withdraw", "build_transaction_withdraw"] },
  { patterns: [/risk|safe|danger|secure/i], toolNames: ["analyze_risk", "get_protocol_info"] },
  { patterns: [/gas|fee|cost|expensive/i], toolNames: ["get_gas_estimate"] },
  { patterns: [/price|eth price|usdc.*price|token.*value/i], toolNames: ["get_token_price"] },
  { patterns: [/protocol|aave|compound|morpho|uniswap|lido|yearn/i], toolNames: ["get_protocol_info"] },
  { patterns: [/market|overview|snapshot|what.*happen/i], toolNames: ["get_market_overview"] },
  { patterns: [/quote|how.*much.*get|slippage|impact/i], toolNames: ["get_quote"] },
  { patterns: [/approval|allowance|spend|permit/i], toolNames: ["check_approval"] },
];

function filterToolsForIntent(goal: string): (typeof tools)[number][] {
  const lower = goal.toLowerCase();

  for (const { patterns, toolNames } of INTENT_TOOL_MAP) {
    if (patterns.some((p) => p.test(lower))) {
      return tools.filter((t) => toolNames.includes(t.function.name));
    }
  }

  return tools.filter((t) =>
    ["discover_opportunities", "get_portfolio_summary"].includes(t.function.name),
  );
}

async function createChatCompletion(
  messages: ChatMessage[],
  model: string = ZAI_MODEL,
  temperature: number = TOOL_TEMP,
  maxTokens: number = MAX_FINAL_TOKENS,
  activeTools: readonly (typeof tools)[number][] = tools,
): Promise<ChatMessage> {
  const apiKey = process.env.ZAI_API_KEY;

  if (!apiKey || apiKey === "your_zai_api_key_here") {
    throw new Error("Missing ZAI_API_KEY. Add your z.ai API key in .env.local.");
  }

  for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(ZAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools: activeTools,
          tool_choice: activeTools.length > 0 ? "auto" : undefined,
          max_tokens: maxTokens,
          temperature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const payload: unknown = await response.json().catch(() => null);
      const shouldRetry =
        response.status === 429 || response.status === 500 || response.status === 503;

      if (!response.ok) {
        if (shouldRetry && attempt < MAX_API_RETRIES) {
          await sleep(500 * 2 ** attempt);
          continue;
        }

        const message =
          extractErrorMessage(payload) ??
          `z.ai request failed with status ${response.status}.`;

        if (response.status === 429) {
          throw new Error(
            "z.ai is rate-limiting requests right now. Please wait a few seconds and try again.",
          );
        }

        throw new Error(message);
      }

      if (!isChatCompletionResponse(payload)) {
        throw new Error("z.ai returned an unexpected response shape.");
      }

      const message = payload.choices?.[0]?.message;
      if (!message) {
        throw new Error("z.ai returned an empty completion response.");
      }

      return {
        role: message.role,
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("z.ai request timed out after 60 seconds.");
      }
      throw err;
    }
  }

  throw new Error("z.ai request failed after multiple attempts.");
}

function safeStringify(data: unknown): string {
  return JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

function truncateToolResult(toolName: string, resultJson: string): string {
  try {
    const data = JSON.parse(resultJson);
    if (!isRecord(data)) return resultJson;

    if (toolName === "discover_opportunities" && Array.isArray(data.opportunities)) {
      const opps = data.opportunities;
      const truncated = opps.slice(0, 7).map((o: Record<string, unknown>) => ({
        protocol: o.protocol,
        asset: o.asset,
        apy: o.apy,
        tvl: o.tvl,
        risk_level: o.risk_level,
        pool_address: o.pool_address,
        recommended: o.recommended,
      }));
      const remaining = opps.length - 7;
      const result: Record<string, unknown> = { ...data, opportunities: truncated };
      if (remaining > 0) result._truncated = `+${remaining} more opportunities available`;
      return JSON.stringify(result);
    }

    if (toolName === "get_positions" && Array.isArray(data.positions)) {
      const positions = data.positions;
      const truncated = positions.map((p: Record<string, unknown>) => ({
        protocol: p.protocol,
        asset: p.asset,
        deposited: p.deposited,
        current_value: p.current_value,
        entry_apy: p.entry_apy,
        position_id: p.position_id,
        chain: p.chain,
      }));
      const result = { ...data, positions: truncated };
      return JSON.stringify(result);
    }

    if (toolName === "get_portfolio_summary") {
      const summary = { ...data };
      if (Array.isArray(summary.token_balances)) {
        summary.token_balances = summary.token_balances.map((b: Record<string, unknown>) => ({
          token: b.token,
          balance: b.balance,
          usd_value: b.usd_value,
        }));
      }
      if (Array.isArray(summary.positions)) {
        summary.positions = summary.positions.map((p: Record<string, unknown>) => ({
          protocol: p.protocol,
          asset: p.asset,
          deposited: p.deposited,
          current_value: p.current_value,
          entry_apy: p.entry_apy,
          position_id: p.position_id,
          chain: p.chain,
        }));
      }
      return JSON.stringify(summary);
    }

    const str = JSON.stringify(data);
    if (str.length > 4000) {
      const truncated = JSON.stringify(data, null, 0);
      return truncated.slice(0, 4000) + '...[truncated]';
    }

    return resultJson;
  } catch {
    if (resultJson.length > 4000) {
      return resultJson.slice(0, 4000) + '...[truncated]';
    }
    return resultJson;
  }
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  send: (type: string, data?: object) => void,
  walletAddress: string,
): Promise<string> {
  const baseChain = BASE_CHAIN;

  switch (name) {
    case "get_portfolio_summary": {
      const result = await getPortfolioSummary(
        input.wallet_address as string || walletAddress,
        input.chain as string | undefined,
      );
      return safeStringify(result);
    }

    case "get_market_overview": {
      const result = await getMarketOverview(
        input.asset as string | undefined,
      );
      return safeStringify(result);
    }

    case "check_balance": {
      const result = await checkTokenBalance(
        baseChain,
        input.token as string,
        input.wallet_address as string || walletAddress,
      );
      return JSON.stringify(result);
    }

    case "check_approval": {
      const result = await checkAllowance(
        baseChain,
        input.token as string,
        input.wallet_address as string || walletAddress,
        input.spender as string,
      );
      return JSON.stringify(result);
    }

    case "discover_opportunities": {
      const result = await discoverOpportunities(
        input.chain as string || baseChain,
        input.min_apy as number | undefined,
        input.max_risk as string | undefined,
        input.protocol as string | undefined,
        input.sort_by as string | undefined,
        input.asset as string | undefined,
        input.limit as number | undefined,
      );
      return JSON.stringify(result);
    }

    case "get_quote": {
      const result = await getQuote(
        input.action as string,
        input.amount as string,
        input.asset as string,
        input.pool_address as string,
        input.chain as string || baseChain,
        input.slippage_tolerance as string | undefined,
      );
      return JSON.stringify(result);
    }

    case "get_positions": {
      const protocols = input.protocols as string[] | undefined;
      const result = await getPositions(
        input.wallet_address as string || walletAddress,
        protocols,
        input.chain as string | undefined,
      );
      return JSON.stringify(result);
    }

    case "analyze_risk": {
      const result = await analyzeRisk(
        input.positions as Array<Record<string, unknown>> | undefined,
        input.time_horizon as string | undefined,
        false,
        false,
      );
      return JSON.stringify(result);
    }

    case "get_token_price": {
      const result = await getTokenPrice(
        input.token as string,
        input.chain as string | undefined,
      );
      return JSON.stringify(result);
    }

    case "get_protocol_info": {
      const result = await getProtocolInfo(
        input.protocol as string,
        input.include_audits as boolean | undefined,
      );
      return JSON.stringify(result);
    }

    case "get_gas_estimate": {
      const result = await getGasEstimate(
        input.chain as string || baseChain,
        input.action as string | undefined,
      );
      return JSON.stringify(result);
    }

    case "prepare_deposit": {
      let poolAddress = input.pool_address as string | undefined;
      let opportunityId = input.opportunity_id as string | undefined;
      const protocolLower = (input.protocol as string || "").toLowerCase();

      if (!poolAddress && !protocolLower.includes("aave") && !protocolLower.includes("compound")) {
        try {
          const lifiResolved = await discoverLifiOpportunities(
            baseChain,
            undefined,
            input.asset as string,
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
            opportunityId = lifiMatch.pool_address;
          } else {
            const resolved = await discoverOpportunities(
              baseChain,
              undefined,
              undefined,
              undefined,
              undefined,
              input.asset as string,
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
          }
        } catch {
          // auto-resolve failed, continue without pool address
        }
      }

      const result = await prepareDeposit(
        input.protocol as string,
        input.asset as string,
        input.amount as string,
        input.chain as string || baseChain,
        input.wallet_address as string || walletAddress,
        opportunityId,
        poolAddress,
      );

      updateState(walletAddress, {
        phase: "ready",
        selectedOpportunity: {
          protocol: input.protocol as string,
          asset: input.asset as string,
          amount: input.amount as string,
          pool_address: poolAddress || opportunityId || "",
          apy: parseFloat(result.estimated_apy) || 0,
        },
      });

      return safeStringify(result);
    }

    case "prepare_withdraw": {
      console.log("[agent] prepare_withdraw called with:", JSON.stringify({ position_id: input.position_id, amount: input.amount, wallet: input.wallet_address || walletAddress }));
      const result = await prepareWithdraw(
        input.position_id as string,
        input.amount as string,
        input.wallet_address as string || walletAddress,
      );
      console.log("[agent] prepare_withdraw result:", result);
      updateState(walletAddress, { phase: "ready", selectedOpportunity: null });
      return safeStringify(result);
    }

    case "build_transaction_deposit":
    case "execute_deposit": {
      const result = await executeDeposit(
        input.protocol as string,
        input.asset as string,
        input.amount as string,
        input.chain as string || baseChain,
        input.user_confirmation as boolean,
        input.wallet_address as string || walletAddress,
        input.opportunity_id as string | undefined,
      );

      if (result.success && result.requires_signature && result.preparation) {
        send("transaction_ready", {
          type: "deposit",
          preparation: result.preparation,
        });
      }

      updateState(walletAddress, {
        phase: result.success ? "executing" : "idle",
        lastTransaction: result.success ? {
          type: "deposit",
          status: "pending",
          protocol: input.protocol as string,
          asset: input.asset as string,
          amount: input.amount as string,
          timestamp: Date.now(),
        } : {
          type: "deposit",
          status: "failed",
          protocol: input.protocol as string,
          error: result.message,
          timestamp: Date.now(),
        },
      });

      return JSON.stringify(result);
    }

    case "build_transaction_withdraw":
    case "execute_withdraw": {
      const result = await executeWithdraw(
        input.position_id as string,
        input.amount as string,
        input.user_confirmation as boolean,
        input.wallet_address as string || walletAddress,
      );

      if (result.success && result.requires_signature && result.preparation) {
        send("transaction_ready", {
          type: "withdraw",
          preparation: result.preparation,
        });
      }

      updateState(walletAddress, {
        phase: result.success ? "executing" : "idle",
        lastTransaction: result.success ? {
          type: "withdraw",
          status: "pending",
          timestamp: Date.now(),
        } : {
          type: "withdraw",
          status: "failed",
          error: result.message,
          timestamp: Date.now(),
        },
      });

      return JSON.stringify(result);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

function getToolResultSummary(toolName: string, resultJson: string): string {
  try {
    const data = JSON.parse(resultJson);
    switch (toolName) {
      case "get_portfolio_summary":
        return `Portfolio: ${data.total_value_usd} | ${data.position_count} positions | ${data.token_balances?.length || 0} tokens`;
      case "get_market_overview":
        return `ETH: $${data.eth_price?.toLocaleString()} | Gas: ${data.base_gas_gwei} gwei | ${data.total_base_opportunities} opportunities`;
      case "check_balance":
        return `Balance: ${data.balance || "0"} ${data.token || ""} (~$${data.usd_value?.toFixed(2) || "0"})`;
      case "check_approval":
        return data.needs_approval ? "Approval needed" : "Already approved";
      case "discover_opportunities":
        return `Found ${data.opportunities?.length || 0} of ${data.total_count || 0} opportunities`;
      case "get_positions":
        return `Retrieved ${data.positions?.length || 0} positions across ${data.chains?.length || 0} chains`;
      case "get_quote":
        return `Quote: ${data.expected_amount_out || "N/A"} ${data.asset || ""}`;
      case "analyze_risk":
        return `Risk score: ${data.overall_score || "N/A"}/100 (${data.score_label || "Unknown"})`;
      case "get_token_price":
        return `$${data.price?.toFixed(2) || "N/A"}`;
      case "get_protocol_info":
        return `${data.name || "Unknown"} - TVL: $${((data.tvl || 0) / 1e9).toFixed(1)}B`;
      case "get_gas_estimate":
        return `${data.gas_price_gwei || "N/A"} gwei (~${data.estimated_cost_usd || "N/A"})`;
      case "prepare_deposit":
        return `${data.protocol} - ${data.amount} ${data.asset} (APY: ${data.estimated_apy})`;
      case "prepare_withdraw":
        return `Withdraw ${data.amount} ${data.asset} from ${data.protocol}`;
      case "build_transaction_deposit":
      case "build_transaction_withdraw":
      case "execute_deposit":
      case "execute_withdraw":
        return data.message || "Prepared";
      default:
        return "Completed";
    }
  } catch {
    return "Completed";
  }
}

function formatInputSummary(toolName: string, input: Record<string, unknown>): string {
  const parts: string[] = [];

  switch (toolName) {
    case "get_portfolio_summary":
      if (input.wallet_address) parts.push(input.wallet_address as string);
      break;
    case "get_market_overview":
      if (input.asset) parts.push(input.asset as string);
      break;
    case "check_balance":
    case "check_approval":
      if (input.token) parts.push(input.token as string);
      break;
    case "discover_opportunities":
      if (input.asset) parts.push(input.asset as string);
      if (input.min_apy) parts.push(`≥${input.min_apy}% APY`);
      if (input.protocol) parts.push(input.protocol as string);
      break;
    case "get_positions":
      if (input.chain) parts.push(input.chain as string);
      break;
    case "get_quote":
      if (input.action) parts.push(input.action as string);
      if (input.amount) parts.push(`${input.amount}`);
      if (input.asset) parts.push(input.asset as string);
      break;
    case "analyze_risk":
      if (input.time_horizon) parts.push(input.time_horizon as string);
      break;
    case "get_token_price":
      if (input.token) parts.push(input.token as string);
      break;
    case "get_protocol_info":
      if (input.protocol) parts.push(input.protocol as string);
      break;
    case "get_gas_estimate":
      if (input.action) parts.push(input.action as string);
      break;
    case "prepare_deposit":
    case "build_transaction_deposit":
    case "execute_deposit":
      if (input.protocol) parts.push(input.protocol as string);
      if (input.amount && input.asset) parts.push(`${input.amount} ${input.asset}`);
      break;
    case "prepare_withdraw":
    case "build_transaction_withdraw":
    case "execute_withdraw":
      if (input.position_id) parts.push(input.position_id as string);
      if (input.amount) parts.push(`${input.amount}`);
      break;
    default:
      break;
  }

  return parts.slice(0, 4).join(" • ");
}

const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

function createErrorStream(message: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: error\ndata: ${JSON.stringify({ message })}\n\n`,
        ),
      );
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

function createGreetingStream(greeting: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, data: object = {}) {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          // stream closed
        }
      }

      send("thinking");
      await new Promise((r) => setTimeout(r, 500));
      send("clear");

      const chunks = greeting.split(/(\s+)/);
      for (const chunk of chunks) {
        send("token", { content: chunk });
        await new Promise((r) => setTimeout(r, 18));
      }

      send("done");
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_TOKENS = 8000;

function compressHistoryMessages(
  chatHistory: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  const compressed: Array<{ role: string; content: string }> = [];
  let budget = MAX_HISTORY_TOKENS;

  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const msg = chatHistory[i];
    if (!msg.content) continue;

    let content = msg.content;

    const toolResultMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (toolResultMatch && toolResultMatch[1].length > 500) {
      const summarized = content.replace(
        /```json\n[\s\S]*?\n```/,
        "```json\n[data compressed: see tool results above]\n```"
      );
      content = summarized;
    }

    const estimatedTokens = content.length / 4;
    if (estimatedTokens > budget) {
      if (content.length > 200) {
        content = content.slice(0, 200) + "...[compressed]";
        budget -= 50;
        compressed.unshift({ role: msg.role, content });
      }
      continue;
    }

    budget -= estimatedTokens;
    compressed.unshift({ role: msg.role, content });
  }

  return compressed.slice(-MAX_HISTORY_MESSAGES);
}

function buildMessagesWithHistory(
  goal: string,
  walletAddress: string,
  chatHistory?: Array<{ role: string; content: string }>,
  stateContext?: string,
): ChatMessage[] {
  const systemPrompt = buildSystemPrompt({
    walletAddress,
    chain: BASE_CHAIN,
    stateContext: stateContext || "",
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  if (chatHistory && chatHistory.length > 0) {
    const compressed = compressHistoryMessages(chatHistory);
    for (const msg of compressed) {
      messages.push(
        msg.role === "user"
          ? { role: "user", content: msg.content }
          : { role: "assistant", content: msg.content } as ChatMessage,
      );
    }
  }

  messages.push({
    role: "user",
    content: `My goal: ${goal}`,
  });

  return messages;
}

export async function POST(req: NextRequest) {
  let body: { goal?: string; wallet_address?: string; model?: string; chat_history?: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch {
    return createErrorStream("Invalid request body.");
  }

  const { goal, wallet_address, model, chat_history } = body;

  if (!goal || !wallet_address) {
    return createErrorStream(
      "Missing required fields: goal and wallet_address",
    );
  }

  const selectedModel = model || ZAI_MODEL;

  if (isCasualGreeting(goal)) {
    return createGreetingStream(
      "Hey! I can help you find DeFi yields, check your positions, analyze risk, or prepare deposits. What would you like to optimize?",
    );
  }

  const agentState = getState(wallet_address);
  const stateContext = formatStateContext(agentState);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, data: object = {}) {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          // stream already closed
        }
      }

      try {
        const messages = buildMessagesWithHistory(goal, wallet_address, chat_history, stateContext);

        updateState(wallet_address, { turnCount: agentState.turnCount + 1 });

        let round = 0;
        let finalMessage: string | null = null;
        let stepIndex = 0;
        let shouldStop = false;

        send("step", { index: stepIndex, label: "Understanding your request", icon: "brain", status: "active" });
        await new Promise((r) => setTimeout(r, 300));
        send("step", { index: stepIndex, label: "Understanding your request", icon: "brain", status: "done" });
        stepIndex++;

        while (round < MAX_TOOL_ROUNDS && !shouldStop) {
          round++;

          const isLikelyFinalRound =
            round >= MAX_TOOL_ROUNDS - 1 ||
            (round > 1 && agentState.phase === "ready");

          send("thinking", { message: round > 1 ? "Analyzing results..." : "Planning approach..." });

          const activeTools = tools;

          let assistantMessage: ChatMessage;
          try {
            assistantMessage = await createChatCompletion(
              messages,
              selectedModel,
              isLikelyFinalRound ? FINAL_TEMP : TOOL_TEMP,
              MAX_FINAL_TOKENS,
              activeTools,
            );
          }catch (llmErr) {
            const errMsg = llmErr instanceof Error ? llmErr.message : String(llmErr);
            console.error("[agent] LLM call failed:", errMsg, { round, toolCount: activeTools.length, model: selectedModel });
            send("error", { message: `LLM error: ${errMsg}` });
            return;
          }
          const toolCalls = assistantMessage.tool_calls ?? [];

          if (toolCalls.length === 0) {
            finalMessage = assistantMessage.content;
            send("step", { index: stepIndex++, label: "Generating response", icon: "sparkles", status: "active" });
            break;
          }

          messages.push({
            role: "assistant",
            content: assistantMessage.content,
            tool_calls: toolCalls,
          });

          const toolPromises = toolCalls.map(async (toolCall) => {
            const toolName = toolCall.function.name;
            const label = TOOL_LABELS[toolName] || `Calling ${toolName}`;
            const icon = TOOL_ICONS[toolName] || "wrench";
            const toolInput = parseToolInput(toolCall.function.arguments);
            const inputSummary = formatInputSummary(toolName, toolInput);

            return { toolCall, toolName, label, icon, toolInput, inputSummary };
          });

          const resolvedTools = await Promise.all(toolPromises);

          const toolResults = await Promise.all(
            resolvedTools.map(async ({ toolCall, toolName, label, icon, toolInput, inputSummary }) => {
              send("step", { index: stepIndex, label, icon, status: "active", input: toolInput, inputSummary });
              send("tool_call", {
                tool: toolName,
                label: `${label}...`,
                icon,
                input: toolInput,
                inputSummary,
              });

              const startTime = Date.now();
              let result: string;
              try {
                result = await Promise.race([
                  executeTool(toolName, toolInput, send, wallet_address),
                  new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("Tool execution timed out after 30s")), 30000)
                  ),
                ]);
              } catch (err) {
                const duration = Date.now() - startTime;
                const errMsg = err instanceof Error ? err.message : "Tool execution failed";

                const isNonRetryable =
                  errMsg.includes("not deployed") ||
                  errMsg.includes("not found") ||
                  errMsg.includes("Unsupported") ||
                  errMsg.includes("Invalid") ||
                  errMsg.includes("Failed to encode");

                send("step", { index: stepIndex, label, icon, status: "error", summary: errMsg, durationMs: duration, input: toolInput, inputSummary, nonRetryable: isNonRetryable });

                return {
                  toolCall,
                  toolName,
                  label,
                  icon,
                  success: false,
                  result: JSON.stringify({
                    error: errMsg,
                    nonRetryable: isNonRetryable,
                    hint: isNonRetryable ? "Do not retry. Adjust parameters or use alternative." : "You may retry once for network errors.",
                  }),
                  durationMs: duration,
                  input: toolInput,
                  inputSummary,
                };
              }

              const duration = Date.now() - startTime;

              const truncatedResult = truncateToolResult(toolName, result);
              const summary = getToolResultSummary(toolName, result);

              send("tool_result", {
                tool: toolName,
                label: label.replace("...", ""),
                icon,
                summary,
                duration_ms: duration,
                success: true,
              });
              send("step", { index: stepIndex, label, icon, status: "done", summary, durationMs: duration, input: toolInput, inputSummary });

              if (toolName === "prepare_deposit" || toolName === "prepare_withdraw") {
                try {
                  const prepData = JSON.parse(result);
                  send("action_required", {
                    type: toolName === "prepare_deposit" ? "deposit" : "withdraw",
                    preparation: prepData,
                    wallet_address: toolInput.wallet_address as string || wallet_address,
                  });
                } catch {
                  // result wasn't valid JSON, skip
                }
              }

              return {
                toolCall,
                toolName,
                label,
                icon,
                success: true,
                result: truncatedResult,
                durationMs: duration,
                input: toolInput,
                inputSummary,
              };
            }),
          );

          for (const tr of toolResults) {
            messages.push({
              role: "tool",
              content: tr.result,
              tool_call_id: tr.toolCall.id,
            });
          }

          stepIndex++;

          const hasPrepareAction = toolResults.some(
            (tr) => tr.toolName === "prepare_deposit" || tr.toolName === "prepare_withdraw"
          );

          const hasBuildAction = toolResults.some(
            (tr) =>
              tr.toolName === "build_transaction_deposit" ||
              tr.toolName === "build_transaction_withdraw" ||
              tr.toolName === "execute_deposit" ||
              tr.toolName === "execute_withdraw"
          );

          if (hasPrepareAction) {
            shouldStop = true;
          }

          if (hasBuildAction && toolResults.every((tr) => tr.success)) {
            shouldStop = true;
          }

          if (round < MAX_TOOL_ROUNDS && !shouldStop) {
            send("thinking", { message: "Deciding next action..." });
          }
        }

        if (agentState.phase === "discovery" || agentState.phase === "idle") {
          const usedDiscovery = messages.some(
            (m) => m.role === "tool" && typeof m.content === "string" && m.content.includes("opportunities")
          );
          if (usedDiscovery) {
            const discoveryMsg = messages.findLast(
              (m) => m.role === "tool" && typeof m.content === "string" && m.content.includes("opportunities")
            );
            if (discoveryMsg?.content) {
              try {
                const parsed = JSON.parse(discoveryMsg.content);
                updateState(wallet_address, {
                  phase: "comparison",
                  lastDiscovery: {
                    timestamp: Date.now(),
                    result_count: parsed.total_count || parsed.opportunities?.length || 0,
                  },
                });
              } catch {}
            }
          }
        }

        let recommendation = finalMessage?.trim();
        if (!recommendation) {
          const lastPrepareCall = messages.findLast(
            (m) =>
              m.role === "assistant" &&
              Array.isArray(m.tool_calls) &&
              m.tool_calls.some((t) => t.function.name === "prepare_deposit" || t.function.name === "prepare_withdraw")
          );
          const prepareToolName = lastPrepareCall?.tool_calls?.[0]?.function.name;
          const prepareCallId = lastPrepareCall?.tool_calls?.[0]?.id;
          const prepareResult = messages.findLast(
            (m) => m.role === "tool" && m.tool_call_id === prepareCallId
          )?.content;
          if (prepareResult) {
            try {
              const prep = JSON.parse(prepareResult);
              if (prep.error) {
                recommendation = `Error: ${prep.error}${prep.hint ? ` (${prep.hint})` : ""}`;
              } else {
                const tx = prep.transaction || prep;
                const actionType = tx.action || (prepareToolName === "prepare_withdraw" ? "withdraw" : "deposit");
                const protocol = prep.protocol || tx.protocol || "";
                const amount = prep.amount || tx.amount || "";
                const asset = prep.asset || tx.asset || "";
                const label = actionType === "withdraw" ? "Withdraw" : "Deposit";
                recommendation = `${label} ${amount} ${asset} ${actionType === "withdraw" ? "from" : "into"} ${protocol} — ready to confirm.`;
              }
            } catch {
              recommendation = "Transaction prepared. Ready to confirm in your wallet.";
            }
          } else {
            recommendation = "No results found. Try checking your balance or discovering opportunities with different filters.";
          }
        }

        send("clear");
        send("step", { index: stepIndex - 1, label: "Generating response", icon: "sparkles", status: "done" });

        const chunks = recommendation.split(/(\s+)/);
        for (const chunk of chunks) {
          send("token", { content: chunk });
          await new Promise((r) => setTimeout(r, 12));
        }

        send("done");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
