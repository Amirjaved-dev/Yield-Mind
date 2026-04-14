export type ReasonedIntent = {
  primaryIntent: string;
  confidence: number;
  userGoal: string;
  extractedParams: Record<string, unknown>;
  suggestedTools: string[];
  reasoning: string;
  ambiguityFlags: string[];
  needsClarification: boolean;
  clarificationQuestion?: string;
  fallbackIntent?: string;
  complexity: "simple" | "moderate" | "complex";
  estimatedSteps: number;
};

const REASONER_SYSTEM_PROMPT = `You are YieldMind's intent reasoning engine. Your ONLY job is to deeply understand what a user wants from their DeFi-related message.

## OUTPUT FORMAT
Return ONLY valid JSON with this exact structure:
{
  "primaryIntent": "deposit|withdraw|discover|portfolio|balance|market|price|risk|protocol_info|gas|quote|approval|greeting|compare|swap|unknown",
  "confidence": 0.0-1.0,
  "userGoal": "one sentence of what they want",
  "extractedParams": { "key": "value" },
  "suggestedTools": ["tool_name"],
  "reasoning": "brief explanation",
  "ambiguityFlags": ["flag1"],
  "needsClarification": false,
  "clarificationQuestion": "optional question if ambiguous",
  "fallbackIntent": "optional backup intent",
  "complexity": "simple|moderate|complex",
  "estimatedSteps": 1-5
}

## INTENT RULES
- deposit: wants to invest, put money into a protocol, earn yield
- withdraw: take money out, unstake, remove position
- discover: find yields, best APY, opportunities, where to invest
- portfolio: overview of all positions, holdings, net worth
- balance: check specific token amount
- market: broad market conditions, overview
- price: specific token price query
- risk: safety analysis, risk score
- protocol_info: details about a specific protocol
- gas: transaction cost estimate
- quote: swap/deposit/withdraw quote
- approval: check or set token allowance
- greeting: hello, hi, hey
- compare: compare protocols, options side by side
- swap: exchange one token for another
- unknown: can't determine

## PARAMETER EXTRACTION
Always extract these when mentioned:
- protocol: aave, compound, morpho, yearn, uniswap, curve, lido, euler, yo protocol
- asset/token: USDC, USDT, ETH, WETH, WBTC, stETH
- amount: numeric value (string)
- chain: base, ethereum, arbitrum, polygon (default: base)
- risk_level: low, medium, high
- min_apy: minimum APY number
- time_horizon: short, medium, long
- position_id: identifier for existing position

## COMPLEXITY RULES
- simple: single tool call needed (check balance, get price)
- moderate: 2-3 tools in sequence (deposit with discovery)
- complex: 4+ tools, conditional logic, or multi-step strategy

## AMBIGUITY FLAGS
Add flags when:
- "missing_amount": action needs amount but none given
- "missing_protocol": protocol mentioned but unclear which
- "ambiguous_asset": could be multiple assets
- "conflicting_params": parameters contradict each other
- "vague_goal": too general to act on precisely

Be precise. Be confident. Extract everything you can.`;

export async function reasonAboutIntent(
  userMessage: string,
  chatHistory?: Array<{ role: string; content: string }>,
): Promise<ReasonedIntent> {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey || apiKey === "your_zai_api_key_here") {
    return fallbackReasoning(userMessage);
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: REASONER_SYSTEM_PROMPT },
  ];

  if (chatHistory && chatHistory.length > 0) {
    const recentHistory = chatHistory.slice(-4);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content.slice(0, 500),
      });
    }
  }

  messages.push({
    role: "user",
    content: `Analyze this user message:\n\n"${userMessage}"`,
  });

  try {
    const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "glm-4.5-airx",
        messages,
        max_tokens: 1024,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn("[reasoner] API call failed, falling back to regex");
      return fallbackReasoning(userMessage);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return fallbackReasoning(userMessage);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[reasoner] No JSON found in response, falling back");
      return fallbackReasoning(userMessage);
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ReasonedIntent>;

    return {
      primaryIntent: parsed.primaryIntent || "unknown",
      confidence: parsed.confidence || 0.5,
      userGoal: parsed.userGoal || userMessage,
      extractedParams: parsed.extractedParams || {},
      suggestedTools: parsed.suggestedTools || [],
      reasoning: parsed.reasoning || "",
      ambiguityFlags: parsed.ambiguityFlags || [],
      needsClarification: parsed.needsClarification || false,
      clarificationQuestion: parsed.clarificationQuestion,
      fallbackIntent: parsed.fallbackIntent,
      complexity: parsed.complexity || "moderate",
      estimatedSteps: parsed.estimatedSteps || 2,
    };
  } catch (err) {
    console.warn("[reasoner] Error, falling back to regex:", err);
    return fallbackReasoning(userMessage);
  }
}

function fallbackReasoning(userMessage: string): ReasonedIntent {
  const lower = userMessage.toLowerCase().trim();

  let primaryIntent = "unknown";
  let confidence = 0.4;
  let complexity: ReasonedIntent["complexity"] = "simple";
  const extractedParams: Record<string, unknown> = {};
  const suggestedTools: string[] = [];

  const protocolMatch = lower.match(/(aave|compound|morpho|yearn|uniswap|curve|lido|euler|yo\s*protocol)/i);
  if (protocolMatch) extractedParams.protocol = protocolMatch[1];

  const assetMatch = lower.match(/\b(usdc|usdt|eth|weth|wbtc|steth)\b/i);
  if (assetMatch) extractedParams.asset = assetMatch[1].toUpperCase();

  const amountMatch = lower.match(/(\d+\.?\d*)/);
  if (amountMatch) extractedParams.amount = amountMatch[1];

  if (/^(hi|hello|hey|yo|sup|gm|good morning|good afternoon|good evening|what'?s up)\b/.test(lower)) {
    primaryIntent = "greeting";
    confidence = 0.99;
    complexity = "simple";
  } else if (/deposit|invest|put.*into|send.*to|place.*in/i.test(lower)) {
    primaryIntent = "deposit";
    confidence = protocolMatch ? 0.95 : amountMatch ? 0.85 : 0.7;
    complexity = "moderate";
    suggestedTools.push("check_balance", "discover_opportunities", "prepare_deposit");
    if (!extractedParams.asset) extractedParams.asset = "USDC";
  } else if (/withdraw|take out|remove|cash out|unstake/i.test(lower)) {
    primaryIntent = "withdraw";
    confidence = 0.85;
    complexity = "moderate";
    suggestedTools.push("get_positions", "prepare_withdraw");
  } else if (/yield|apy|earn|interest|best.*return|opportunit|find.*vault|where.*invest/i.test(lower)) {
    primaryIntent = "discover";
    confidence = 0.9;
    complexity = "simple";
    suggestedTools.push("discover_opportunities");
  } else if (/portfolio|position|holdings|my.*wallet|what.*do i have|my.*asset/i.test(lower)) {
    primaryIntent = "portfolio";
    confidence = 0.9;
    complexity = "simple";
    suggestedTools.push("get_portfolio_summary");
  } else if (/balance|how much.*(do i have|i own)|check.*balance/i.test(lower)) {
    primaryIntent = "balance";
    confidence = 0.85;
    complexity = "simple";
    suggestedTools.push("check_balance");
  } else if (/compare|vs|versus|which.*better/i.test(lower)) {
    primaryIntent = "compare";
    confidence = 0.8;
    complexity = "moderate";
    suggestedTools.push("discover_opportunities", "analyze_risk");
  } else if (/market|overview|snapshot|what.*happen/i.test(lower)) {
    primaryIntent = "market";
    confidence = 0.8;
    complexity = "simple";
    suggestedTools.push("get_market_overview");
  } else if (/price|token.*value|how much.*(is|worth)/i.test(lower)) {
    primaryIntent = "price";
    confidence = 0.85;
    complexity = "simple";
    suggestedTools.push("get_token_price");
  } else if (/risk|safe|danger|secure|risk.*score/i.test(lower)) {
    primaryIntent = "risk";
    confidence = 0.8;
    complexity = "moderate";
    suggestedTools.push("analyze_risk", "get_portfolio_summary");
  } else if (/protocol info|about.*(aave|compound|morpho)|tell me about/i.test(lower)) {
    primaryIntent = "protocol_info";
    confidence = 0.8;
    complexity = "simple";
    suggestedTools.push("get_protocol_info");
  } else if (/gas|fee|cost|expensive/i.test(lower) && !/price/i.test(lower)) {
    primaryIntent = "gas";
    confidence = 0.75;
    complexity = "simple";
    suggestedTools.push("get_gas_estimate");
  } else if (/swap|exchange|trade.*for|convert/i.test(lower)) {
    primaryIntent = "swap";
    confidence = 0.75;
    complexity = "complex";
    suggestedTools.push("get_quote", "discover_opportunities");
  }

  const ambiguityFlags: string[] = [];
  if (primaryIntent === "deposit" && !amountMatch) ambiguityFlags.push("missing_amount");
  if (lower.includes("protocol") && !protocolMatch) ambiguityFlags.push("missing_protocol");

  return {
    primaryIntent,
    confidence,
    userGoal: userMessage,
    extractedParams,
    suggestedTools,
    reasoning: `Fallback regex match: ${primaryIntent}`,
    ambiguityFlags,
    needsClarification: ambiguityFlags.length > 0 && confidence < 0.8,
    complexity,
    estimatedSteps: suggestedTools.length || 1,
  };
}

export function formatReasonerContext(reasoned: ReasonedIntent): string {
  const parts: string[] = [
    `Intent: ${reasoned.primaryIntent} (${Math.round(reasoned.confidence * 100)}%)`,
    `Goal: ${reasoned.userGoal}`,
    `Complexity: ${reasoned.complexity}`,
    `Est. steps: ${reasoned.estimatedSteps}`,
  ];

  if (reasoned.extractedParams && Object.keys(reasoned.extractedParams).length > 0) {
    parts.push(`Params: ${JSON.stringify(reasoned.extractedParams)}`);
  }
  if (reasoned.suggestedTools.length > 0) {
    parts.push(`Suggested tools: ${reasoned.suggestedTools.join(", ")}`);
  }
  if (reasoned.ambiguityFlags.length > 0) {
    parts.push(`Flags: ${reasoned.ambiguityFlags.join(", ")}`);
  }
  if (reasoned.reasoning) {
    parts.push(`Reasoning: ${reasoned.reasoning}`);
  }

  return parts.join("\n");
}
