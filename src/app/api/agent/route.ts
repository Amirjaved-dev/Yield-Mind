import { NextRequest } from "next/server";
import { tools } from "@/lib/agent-tools";
import {
  discoverOpportunities,
  getPositions,
  getQuote,
  analyzeRisk,
} from "@/lib/defi-data";

const MAX_TOOL_ROUNDS = 10;
const MAX_API_RETRIES = 2;
const ZAI_CHAT_COMPLETIONS_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const ZAI_MODEL = "glm-5.1";

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
  discover_opportunities: "Scanning DeFi protocols",
  get_positions: "Fetching your positions",
  get_quote: "Getting deposit quote",
  analyze_risk: "Analyzing risk profile",
};

const TOOL_ICONS: Record<string, string> = {
  discover_opportunities: "magnifying-glass",
  get_positions: "wallet",
  get_quote: "calculator",
  analyze_risk: "shield",
};

const SYSTEM_PROMPT = `You are YieldMind, an expert DeFi yield optimization agent. Your job is to help users maximize their yield while managing risk appropriately.

Use tools selectively, not automatically. For example:
1. Use discover_opportunities when the user wants better yield ideas or comparisons
2. Use get_positions when the user asks about their current portfolio or when it is necessary for a recommendation
3. Use get_quote only when a concrete deposit or withdrawal path is being discussed
4. Use analyze_risk when you are evaluating allocation safety or tradeoffs

For casual greetings or simple small talk, reply naturally and briefly without calling tools.

Always base your recommendations on actual tool results. Be specific about amounts, APYs, protocols, and risks.
Prefer concise GitHub-flavored Markdown with short headings and bullets. Avoid oversized tables unless the user explicitly asks for a table.
Format substantive recommendations with:
- Summary
- Specific actions
- Risk assessment
- Step-by-step instructions

If you need more information from the user, ask for it before making assumptions.`;

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
        model: ZAI_MODEL,
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: 4096,
        temperature: 0.3,
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
    case "discover_opportunities": {
      const result = await discoverOpportunities(
        input.chain as string | undefined,
        input.min_apy as number | undefined,
        input.max_risk as string | undefined,
        input.protocol as string | undefined,
      );
      return JSON.stringify(result);
    }

    case "get_quote": {
      const result = await getQuote(
        input.action as string,
        input.amount as string,
        input.asset as string,
        input.pool_address as string,
        input.slippage_tolerance as string | undefined,
      );
      return JSON.stringify(result);
    }

    case "get_positions": {
      const result = await getPositions(
        input.wallet_address as string,
        input.protocol as string | undefined,
        input.chain as string | undefined,
      );
      return JSON.stringify(result);
    }

    case "analyze_risk": {
      const result = await analyzeRisk(
        input.positions as Array<Record<string, unknown>> | undefined,
        input.time_horizon as string | undefined,
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
      case "discover_opportunities":
        return `Found ${(data.opportunities || []).length} opportunities`;
      case "get_positions":
        return `Retrieved ${(data.positions || []).length} positions`;
      case "get_quote":
        return `Got quote for ${(data.action || "transaction")}`;
      case "analyze_risk":
        return `Risk score: ${data.overall_risk_level || "calculated"}`;
      default:
        return "Completed";
    }
  } catch {
    return "Completed";
  }
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

  const { goal, wallet_address } = body;

  if (!goal || !wallet_address) {
    return createErrorStream(
      "Missing required fields: goal and wallet_address",
    );
  }

  if (isCasualGreeting(goal)) {
    return createGreetingStream(
      "Hey! I can help you compare DeFi yields, review your current positions, assess risk, or prepare a deposit quote. Tell me what you want to optimize and I'll keep it concise.",
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

        send("step", { index: stepIndex++, label: "Understanding your request", icon: "brain" });

        while (round < MAX_TOOL_ROUNDS) {
          round++;

          send("thinking", { message: round > 1 ? "Analyzing tool results..." : "Thinking about the best approach..." });

          const assistantMessage = await createChatCompletion(messages);
          const toolCalls = assistantMessage.tool_calls ?? [];

          if (toolCalls.length === 0) {
            finalMessage = assistantMessage.content;
            send("step", { index: stepIndex++, label: "Generating recommendation", icon: "sparkles", status: "active" });
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

            send("step", { index: stepIndex, label, icon, status: "active" });
            send("tool_call", {
              tool: toolName,
              label: `${label}...`,
              icon,
            });

            const startTime = Date.now();
            const result = await executeTool(
              toolName,
              parseToolInput(toolCall.function.arguments),
            );
            const duration = Date.now() - startTime;

            const summary = getToolResultSummary(toolName, result);
            send("tool_result", {
              tool: toolName,
              label: label.replace("...", ""),
              icon,
              summary,
              duration_ms: duration,
            });
            send("step", { index: stepIndex, label, icon, status: "done", summary });

            messages.push({
              role: "tool",
              content: result,
              tool_call_id: toolCall.id,
            });

            stepIndex++;
          }
        }

        const recommendation =
          finalMessage?.trim() ||
          "Unable to generate a recommendation. Please try again.";

        send("clear");

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
