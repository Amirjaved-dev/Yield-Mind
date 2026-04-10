import { NextRequest } from "next/server";
import { tools } from "@/lib/agent-tools";
import { SYSTEM_PROMPT } from "@/lib/prompts/system-prompt";
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
} from "@/lib/defi-data";

const MAX_TOOL_ROUNDS = 10;
const MAX_API_RETRIES = 2;
const ZAI_CHAT_COMPLETIONS_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const ZAI_MODEL = "glm-4.5-airx";

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
  check_balance: "Checking token balance",
  check_approval: "Checking approval status",
  discover_opportunities: "Scanning DeFi protocols",
  get_positions: "Fetching your positions",
  get_quote: "Getting deposit quote",
  analyze_risk: "Analyzing risk profile",
  get_token_price: "Fetching token price",
  get_protocol_info: "Looking up protocol",
  get_gas_estimate: "Estimating gas costs",
  prepare_deposit: "Preparing deposit transaction",
  prepare_withdraw: "Preparing withdrawal transaction",
  execute_deposit: "Preparing deposit",
  execute_withdraw: "Preparing withdrawal",
};

const TOOL_ICONS: Record<string, string> = {
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

async function createChatCompletion(
  messages: ChatMessage[],
  model: string = ZAI_MODEL,
): Promise<ChatMessage> {
  const apiKey = process.env.ZAI_API_KEY;

  if (!apiKey || apiKey === "your_zai_api_key_here") {
    throw new Error("Missing ZAI_API_KEY. Add your z.ai API key in .env.local.");
  }

  for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
    const response = await fetch(ZAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: 2048,
        temperature: 0.4,
      }),
    });

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
  }

  throw new Error("z.ai request failed after multiple attempts.");
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "check_balance": {
      const result = await checkTokenBalance(
        input.chain as string,
        input.token as string,
        input.wallet_address as string,
      );
      return JSON.stringify(result);
    }

    case "check_approval": {
      const result = await checkAllowance(
        input.chain as string,
        input.token as string,
        input.wallet_address as string,
        input.spender as string,
      );
      return JSON.stringify(result);
    }

    case "discover_opportunities": {
      let result;
      try {
        result = await discoverLifiOpportunities(
          input.chain as string | undefined,
          input.min_apy as number | undefined,
          input.asset as string | undefined,
          input.limit as number | undefined,
        );
      } catch {
        result = await discoverOpportunities(
          input.chain as string | undefined,
          input.min_apy as number | undefined,
          input.max_risk as string | undefined,
          input.protocol as string | undefined,
          input.sort_by as string | undefined,
          input.asset as string | undefined,
          input.limit as number | undefined,
        );
      }
      return JSON.stringify(result);
    }

    case "get_quote": {
      const result = await getQuote(
        input.action as string,
        input.amount as string,
        input.asset as string,
        input.pool_address as string,
        input.chain as string | undefined,
        input.slippage_tolerance as string | undefined,
      );
      return JSON.stringify(result);
    }

    case "get_positions": {
      const protocols = input.protocols as string[] | undefined;
      const result = await getPositions(
        input.wallet_address as string,
        protocols,
        input.chain as string | undefined,
        input.include_history as boolean | undefined,
      );
      return JSON.stringify(result);
    }

    case "analyze_risk": {
      const result = await analyzeRisk(
        input.positions as Array<Record<string, unknown>> | undefined,
        input.time_horizon as string | undefined,
        input.include_oracle_risk as boolean | undefined,
        input.check_onchain as boolean | undefined,
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
        input.include_tvl_history as boolean | undefined,
      );
      return JSON.stringify(result);
    }

    case "get_gas_estimate": {
      const result = await getGasEstimate(
        input.chain as string,
        input.action as string | undefined,
      );
      return JSON.stringify(result);
    }

    case "prepare_deposit": {
      const result = await prepareDeposit(
        input.protocol as string,
        input.asset as string,
        input.amount as string,
        input.chain as string,
        input.wallet_address as string,
        input.opportunity_id as string | undefined,
      );
      return JSON.stringify(result);
    }

    case "prepare_withdraw": {
      const result = await prepareWithdraw(
        input.position_id as string,
        input.amount as string,
        input.wallet_address as string,
      );
      return JSON.stringify(result);
    }

    case "execute_deposit": {
      const result = await executeDeposit(
        input.protocol as string,
        input.asset as string,
        input.amount as string,
        input.chain as string,
        input.user_confirmation as boolean,
        input.wallet_address as string,
        input.opportunity_id as string | undefined,
      );
      return JSON.stringify(result);
    }

    case "execute_withdraw": {
      const result = await executeWithdraw(
        input.position_id as string,
        input.amount as string,
        input.user_confirmation as boolean,
        input.wallet_address as string,
      );
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
    case "check_balance":
    case "check_approval":
      if (input.chain) parts.push(input.chain as string);
      if (input.token) parts.push(input.token as string);
      break;
    case "discover_opportunities":
      if (input.chain) parts.push(input.chain as string);
      if (input.asset) parts.push(input.asset as string);
      if (input.min_apy) parts.push(`≥${input.min_apy}% APY`);
      if (input.protocol) parts.push(input.protocol as string);
      break;
    case "get_positions":
      if (input.chain) parts.push(input.chain as string);
      if (input.protocols) parts.push((input.protocols as string[]).join(", "));
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
      if (input.chain) parts.push(`on ${input.chain}`);
      break;
    case "get_protocol_info":
      if (input.protocol) parts.push(input.protocol as string);
      break;
    case "get_gas_estimate":
      if (input.chain) parts.push(input.chain as string);
      if (input.action) parts.push(input.action as string);
      break;
    case "prepare_deposit":
    case "execute_deposit":
      if (input.chain) parts.push(input.chain as string);
      if (input.protocol) parts.push(input.protocol as string);
      if (input.amount && input.asset) parts.push(`${input.amount} ${input.asset}`);
      break;
    case "prepare_withdraw":
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

export async function POST(req: NextRequest) {
  let body: { goal?: string; wallet_address?: string };
  try {
    body = await req.json();
  } catch {
    return createErrorStream("Invalid request body.");
  }

  const { goal, wallet_address, model } = body;

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
        const messages: ChatMessage[] = [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `My goal: ${goal}\nMy wallet address: ${wallet_address}`,
          },
        ];

        let round = 0;
        let finalMessage: string | null = null;
        let stepIndex = 0;

        send("step", { index: stepIndex, label: "Understanding your request", icon: "brain", status: "active" });
        await new Promise((r) => setTimeout(r, 300));
        send("step", { index: stepIndex, label: "Understanding your request", icon: "brain", status: "done" });
        stepIndex++;

        while (round < MAX_TOOL_ROUNDS) {
          round++;

          send("thinking", { message: round > 1 ? "Analyzing results..." : "Planning approach..." });

          const assistantMessage = await createChatCompletion(messages, selectedModel);
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

          for (const toolCall of toolCalls) {
            const toolName = toolCall.function.name;
            const label = TOOL_LABELS[toolName] || `Calling ${toolName}`;
            const icon = TOOL_ICONS[toolName] || "wrench";
            const toolInput = parseToolInput(toolCall.function.arguments);
            const inputSummary = formatInputSummary(toolName, toolInput);

            send("step", { index: stepIndex, label, icon, status: "active", input: toolInput, inputSummary });
            send("tool_call", {
              tool: toolName,
              label: `${label}...`,
              icon,
              input: toolInput,
              inputSummary,
            });

            const startTime = Date.now();
            const result = await executeTool(
              toolName,
              toolInput,
            );
            const duration = Date.now() - startTime;

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

            messages.push({
              role: "tool",
              content: result,
              tool_call_id: toolCall.id,
            });

            stepIndex++;
          }
          
          if (round < MAX_TOOL_ROUNDS && toolCalls.length > 0) {
            send("thinking", { message: "Deciding next action..." });
          }
        }

        const recommendation =
          finalMessage?.trim() ||
          "Unable to generate a recommendation. Please try again.";

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
