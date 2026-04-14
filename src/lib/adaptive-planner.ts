import type { ReasonedIntent } from "./agent-reasoner";

export type AdaptiveStep = {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  label: string;
  icon: string;
  required: boolean;
  skipIfCached: boolean;
  cacheKey?: string;
  dependsOn?: string[];
  retryCount: number;
  maxRetries: number;
  fallbackTool?: string;
  fallbackInput?: Record<string, unknown>;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  result?: string;
  error?: string;
  durationMs?: number;
};

export type AdaptationDecision = {
  shouldRetry: boolean;
  strategy: "retry_same" | "retry_with_params" | "substitute_tool" | "skip_and_continue" | "abort" | "try_fallback";
  reason: string;
  newInput?: Record<string, unknown>;
  newTool?: string;
  messageToUser?: string;
};

export type AdaptationCycle = {
  cycleNumber: number;
  triggerStep: string;
  errorSummary: string;
  decision: AdaptationDecision;
  timestamp: number;
};

export type AdaptivePlan = {
  id: string;
  intent: ReasonedIntent;
  phases: AdaptiveStep[][];
  description: string;
  currentPhase: number;
  totalPhases: number;
  adaptationHistory: AdaptationCycle[];
  maxAdaptations: number;
  adaptationCount: number;
  status: "planning" | "executing" | "adapting" | "completed" | "failed" | "partial";
  resultSummary?: string;
  allResults: Map<string, { step: AdaptiveStep; result: string }>;
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

function generateId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function stepId(toolName: string, index: number): string {
  return `${toolName}_${index}`;
}

export function buildAdaptivePlan(
  intent: ReasonedIntent,
  walletAddress: string,
  chain: string = "base",
): AdaptivePlan {
  const params = intent.extractedParams;
  const phases: AdaptiveStep[][] = [];

  switch (intent.primaryIntent) {
    case "greeting":
      return {
        id: generateId(),
        intent,
        phases: [],
        description: "Greeting — no tools needed",
        currentPhase: 0,
        totalPhases: 0,
        adaptationHistory: [],
        maxAdaptations: 3,
        adaptationCount: 0,
        status: "completed",
        allResults: new Map(),
      };

    case "deposit": {
      const asset = (params.asset as string) || "USDC";
      const protocol = params.protocol as string | undefined;
      const amount = params.amount as string | undefined;

      const phase1: AdaptiveStep[] = [
        {
          id: stepId("check_balance", 0),
          toolName: "check_balance",
          toolInput: { chain, token: asset, wallet_address: walletAddress },
          label: `Checking ${asset} balance`,
          icon: TOOL_ICONS.check_balance,
          required: false,
          skipIfCached: true,
          cacheKey: `balance_${asset}`,
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          status: "pending",
        },
        {
          id: stepId("discover_opportunities", 1),
          toolName: "discover_opportunities",
          toolInput: {
            chain,
            ...(protocol ? { protocol } : {}),
            ...(asset && !protocol ? { asset } : {}),
            limit: 15,
          },
          label: protocol
            ? `Finding ${protocol} opportunities`
            : `Scanning DeFi yields`,
          icon: TOOL_ICONS.discover_opportunities,
          required: true,
          skipIfCached: true,
          cacheKey: `disc_${protocol || "all"}_${asset || "all"}`,
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          fallbackTool: undefined,
          status: "pending",
        },
      ];

      const phase2: AdaptiveStep[] = [
        {
          id: stepId("prepare_deposit", 2),
          toolName: "prepare_deposit",
          toolInput: {
            protocol: protocol || "",
            asset,
            amount: amount || "",
            chain,
            wallet_address: walletAddress,
          },
          label: `Preparing deposit${protocol ? ` into ${protocol}` : ""}${amount ? ` of ${amount}` : ""}`,
          icon: TOOL_ICONS.prepare_deposit,
          required: true,
          skipIfCached: false,
          dependsOn: [stepId("discover_opportunities", 1)],
          retryCount: 0,
          maxRetries: 2,
          fallbackTool: "discover_opportunities",
          fallbackInput: { chain, asset, limit: 25 },
          status: "pending",
        },
      ];

      phases.push(phase1, phase2);
      break;
    }

    case "withdraw": {
      const positionId = params.position_id as string | undefined;
      const amount = params.amount as string | undefined;

      phases.push([
        {
          id: stepId("get_positions", 0),
          toolName: "get_positions",
          toolInput: { wallet_address: walletAddress, chain },
          label: "Fetching your positions",
          icon: TOOL_ICONS.get_positions,
          required: true,
          skipIfCached: true,
          cacheKey: "positions",
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          status: "pending",
        },
      ]);

      phases.push([
        {
          id: stepId("prepare_withdraw", 1),
          toolName: "prepare_withdraw",
          toolInput: {
            position_id: positionId || "",
            amount: amount || "max",
            wallet_address: walletAddress,
          },
          label: `Preparing withdrawal${amount ? ` of ${amount}` : ""}`,
          icon: TOOL_ICONS.prepare_withdraw,
          required: true,
          skipIfCached: false,
          dependsOn: [stepId("get_positions", 0)],
          retryCount: 0,
          maxRetries: 2,
          status: "pending",
        },
      ]);
      break;
    }

    case "discover": {
      const asset = params.asset as string | undefined;
      const protocol = params.protocol as string | undefined;
      const minApy = params.min_apy as number | undefined;

      phases.push([
        {
          id: stepId("discover_opportunities", 0),
          toolName: "discover_opportunities",
          toolInput: {
            chain,
            ...(asset ? { asset } : {}),
            ...(protocol ? { protocol } : {}),
            ...(minApy ? { min_apy: minApy } : {}),
            limit: 20,
          },
          label: protocol
            ? `Scanning ${protocol}`
            : asset
              ? `Scanning ${asset} yields`
              : "Scanning all DeFi yields",
          icon: TOOL_ICONS.discover_opportunities,
          required: true,
          skipIfCached: true,
          cacheKey: `disc_${protocol || "all"}_${asset || "all"}`,
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          fallbackTool: "get_market_overview",
          fallbackInput: {},
          status: "pending",
        },
      ]);
      break;
    }

    case "portfolio":
      phases.push([
        {
          id: stepId("get_portfolio_summary", 0),
          toolName: "get_portfolio_summary",
          toolInput: { wallet_address: walletAddress, chain },
          label: "Fetching portfolio summary",
          icon: TOOL_ICONS.get_portfolio_summary,
          required: true,
          skipIfCached: true,
          cacheKey: "portfolio",
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          status: "pending",
        },
      ]);
      break;

    case "balance": {
      const token = (params.token as string) || (params.asset as string) || "USDC";
      phases.push([
        {
          id: stepId("check_balance", 0),
          toolName: "check_balance",
          toolInput: { chain, token, wallet_address: walletAddress },
          label: `Checking ${token} balance`,
          icon: TOOL_ICONS.check_balance,
          required: true,
          skipIfCached: true,
          cacheKey: `balance_${token}`,
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          status: "pending",
        },
      ]);
      break;
    }

    case "market":
      phases.push([
        {
          id: stepId("get_market_overview", 0),
          toolName: "get_market_overview",
          toolInput: {},
          label: "Getting market overview",
          icon: TOOL_ICONS.get_market_overview,
          required: true,
          skipIfCached: true,
          cacheKey: "market",
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          status: "pending",
        },
      ]);
      break;

    case "price": {
      const token = (params.token as string) || (params.asset as string) || "ETH";
      phases.push([
        {
          id: stepId("get_token_price", 0),
          toolName: "get_token_price",
          toolInput: { token },
          label: `Fetching ${token} price`,
          icon: TOOL_ICONS.get_token_price,
          required: true,
          skipIfCached: false,
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          status: "pending",
        },
      ]);
      break;
    }

    case "risk": {
      phases.push(
        [
          {
            id: stepId("get_portfolio_summary", 0),
            toolName: "get_portfolio_summary",
            toolInput: { wallet_address: walletAddress, chain },
            label: "Fetching portfolio for risk analysis",
            icon: TOOL_ICONS.get_portfolio_summary,
            required: true,
            skipIfCached: true,
            cacheKey: "portfolio",
            dependsOn: [],
            retryCount: 0,
            maxRetries: 2,
            status: "pending",
          },
        ],
        [
          {
            id: stepId("analyze_risk", 1),
            toolName: "analyze_risk",
            toolInput: {
              positions: [],
              time_horizon: (params.time_horizon as string) || "medium",
            },
            label: "Analyzing risk profile",
            icon: TOOL_ICONS.analyze_risk,
            required: true,
            skipIfCached: false,
            dependsOn: [stepId("get_portfolio_summary", 0)],
            retryCount: 0,
            maxRetries: 2,
            status: "pending",
          },
        ],
      );
      break;
    }

    case "compare":
      phases.push([
        {
          id: stepId("discover_opportunities", 0),
          toolName: "discover_opportunities",
          toolInput: { chain, limit: 20, sort_by: "apy" },
          label: "Fetching protocols for comparison",
          icon: TOOL_ICONS.discover_opportunities,
          required: true,
          skipIfCached: true,
          cacheKey: "disc_all_all",
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          status: "pending",
        },
      ]);
      break;

    case "protocol_info": {
      const protocol = (params.protocol as string) || "aave";
      phases.push([
        {
          id: stepId("get_protocol_info", 0),
          toolName: "get_protocol_info",
          toolInput: { protocol },
          label: `Looking up ${protocol}`,
          icon: TOOL_ICONS.get_protocol_info,
          required: true,
          skipIfCached: false,
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          status: "pending",
        },
      ]);
      break;
    }

    case "gas":
      phases.push([
        {
          id: stepId("get_gas_estimate", 0),
          toolName: "get_gas_estimate",
          toolInput: { chain },
          label: "Estimating gas costs",
          icon: TOOL_ICONS.get_gas_estimate,
          required: true,
          skipIfCached: true,
          cacheKey: "gas",
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          status: "pending",
        },
      ]);
      break;

    default:
      phases.push([
        {
          id: stepId("discover_opportunities", 0),
          toolName: "discover_opportunities",
          toolInput: { chain, limit: 10 },
          label: "Exploring available options",
          icon: TOOL_ICONS.discover_opportunities,
          required: true,
          skipIfCached: true,
          dependsOn: [],
          retryCount: 0,
          maxRetries: 2,
          status: "pending",
        },
      ]);
      break;
  }

  return {
    id: generateId(),
    intent,
    phases,
    description: `${intent.primaryIntent}: ${phases.length} phase(s), ${phases.reduce((sum, p) => sum + p.length, 0)} total steps`,
    currentPhase: 0,
    totalPhases: phases.length,
    adaptationHistory: [],
    maxAdaptations: 3,
    adaptationCount: 0,
    status: "planning",
    allResults: new Map(),
  };
}

const DIAGNOSE_SYSTEM_PROMPT = `You are YieldMind's failure diagnosis engine. A tool just failed during execution. Analyze the error and decide what to do.

## YOUR JOB
Given the context below, decide the BEST recovery strategy. Be smart about it.

## STRATEGIES
- "retry_same": transient error (network, timeout) — same params, just retry
- "retry_with_params": wrong parameters — fix them based on error message
- "substitute_tool": this tool can't work — use a different approach/tool entirely
- "skip_and_continue": non-critical step failed — move on without it
- "abort": critical unrecoverable error — stop everything
- "try_fallback": try the designated fallback tool/input for this step

## OUTPUT FORMAT
Return ONLY valid JSON:
{
  "shouldRetry": true/false,
  "strategy": "one_of_above",
  "reason": "brief explanation",
  "newInput": {} (only if retry_with_params),
  "newTool": "tool_name" (only if substitute_tool),
  "messageToUser": "what to tell user about this"
}

## RULES
1. If error mentions "not found", "not deployed", "invalid" → likely substitute_tool or retry_with_params
2. If error mentions "timeout", "network", "rate limit" → retry_same
3. If error mentions "nonRetryable" → do NOT retry_same, try something else
4. If step.required is false → prefer skip_and_continue
5. If we've already retried 2+ times → prefer substitute or skip
6. Always set messageToUser when changing strategy so user knows what's happening`;

export async function diagnoseFailure(
  failedStep: AdaptiveStep,
  plan: AdaptivePlan,
  allResultsSoFar: Map<string, { step: AdaptiveStep; result: string }>,
): Promise<AdaptationDecision> {
  const apiKey = process.env.ZAI_API_KEY;

  if (!apiKey || apiKey === "your_zai_api_key_here") {
    return diagnoseFailureRuleBased(failedStep, plan);
  }

  const resultsContext = Array.from(allResultsSoFar.entries())
    .map(([id, { step, result }]) => `- ${step.toolName} (${id}): ${result.slice(0, 200)}`)
    .join("\n");

  const userMessage = JSON.stringify({
    failedStep: {
      toolName: failedStep.toolName,
      input: failedStep.toolInput,
      error: failedStep.error,
      retryCount: failedStep.retryCount,
      required: failedStep.required,
      hasFallback: !!failedStep.fallbackTool,
    },
    planContext: {
      intent: plan.intent.primaryIntent,
      currentPhase: plan.currentPhase,
      adaptationsUsed: plan.adaptationCount,
      maxAdaptations: plan.maxAdaptations,
    },
    previousResults: resultsContext,
  }, null, 2);

  try {
    const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "glm-4.5-airx",
        messages: [
          { role: "system", content: DIAGNOSE_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Diagnose this failure and recommend recovery:\n\n${userMessage}`,
          },
        ],
        max_tokens: 512,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return diagnoseFailureRuleBased(failedStep, plan);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return diagnoseFailureRuleBased(failedStep, plan);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return diagnoseFailureRuleBased(failedStep, plan);
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<AdaptationDecision>;

    return {
      shouldRetry: parsed.shouldRetry ?? true,
      strategy: parsed.strategy ?? "retry_same",
      reason: parsed.reason || "LLM diagnosis completed",
      newInput: parsed.newInput,
      newTool: parsed.newTool,
      messageToUser: parsed.messageToUser,
    };
  } catch {
    return diagnoseFailureRuleBased(failedStep, plan);
  }
}

function diagnoseFailureRuleBased(failedStep: AdaptiveStep, _plan: AdaptivePlan): AdaptationDecision {
  const err = failedStep.error?.toLowerCase() || "";
  const step = failedStep;

  if (err.includes("timeout") || err.includes("network") || err.includes("rate.limit") || err.includes("429")) {
    return {
      shouldRetry: step.retryCount < step.maxRetries,
      strategy: "retry_same",
      reason: "Transient network/timeout error — safe to retry",
    };
  }

  if (err.includes("nonretryable") || err.includes("not deployed") || err.includes("not found") || err.includes("unsupported")) {
    if (step.fallbackTool && step.retryCount === 0) {
      return {
        shouldRetry: true,
        strategy: "try_fallback",
        reason: `Primary tool failed, trying fallback: ${step.fallbackTool}`,
        messageToUser: `Switching to alternative data source...`,
      };
    }
    if (!step.required) {
      return {
        shouldRetry: false,
        strategy: "skip_and_continue",
        reason: "Non-critical tool failed with unrecoverable error",
        messageToUser: `Couldn't fetch ${step.toolName}, continuing with available data`,
      };
    }
    return {
      shouldRetry: false,
      strategy: "abort",
      reason: `Critical tool ${step.toolName} failed with unrecoverable error`,
      messageToUser: `Error: ${err.slice(0, 100)}. Try rephrasing your request.`,
    };
  }

  if (err.includes("invalid") || err.includes("missing") || err.includes("failed to encode")) {
    if (step.retryCount < step.maxRetries) {
      return {
        shouldRetry: true,
        strategy: "retry_with_params",
        reason: "Parameter issue detected, will attempt correction",
        messageToUser: "Adjusting request parameters...",
      };
    }
  }

  if (step.retryCount >= step.maxRetries) {
    if (!step.required) {
      return {
        shouldRetry: false,
        strategy: "skip_and_continue",
        reason: `Max retries (${step.maxRetries}) reached for non-critical step`,
        messageToUser: `${step.toolName} unavailable after retries, proceeding`,
      };
    }
    return {
      shouldRetry: false,
      strategy: "abort",
      reason: `Max retries reached for critical step: ${step.toolName}`,
      messageToUser: `${step.toolName} keeps failing. Try a different approach.`,
    };
  }

  return {
    shouldRetry: true,
    strategy: "retry_same",
    reason: "Unknown error, attempting standard retry",
  };
}

export function applyAdaptation(
  plan: AdaptivePlan,
  stepIndex: number,
  decision: AdaptationDecision,
): AdaptivePlan {
  const updatedPhases = plan.phases.map((phase) =>
    phase.map((s) => ({ ...s }))
  );
  const targetStep = updatedPhases[plan.currentPhase]?.[stepIndex];

  if (!targetStep) return plan;

  const cycle: AdaptationCycle = {
    cycleNumber: plan.adaptationCount + 1,
    triggerStep: targetStep.id,
    errorSummary: targetStep.error || "Unknown error",
    decision,
    timestamp: Date.now(),
  };

  switch (decision.strategy) {
    case "retry_same":
      targetStep.retryCount++;
      targetStep.status = "pending";
      targetStep.error = undefined;
      break;

    case "retry_with_params":
      targetStep.retryCount++;
      targetStep.status = "pending";
      targetStep.error = undefined;
      if (decision.newInput) {
        targetStep.toolInput = { ...targetStep.toolInput, ...decision.newInput };
      }
      break;

    case "substitute_tool":
      targetStep.retryCount++;
      targetStep.status = "pending";
      targetStep.error = undefined;
      if (decision.newTool) {
        targetStep.toolName = decision.newTool;
        targetStep.label = `Trying ${decision.newTool} (adapted)`;
        targetStep.icon = TOOL_ICONS[decision.newTool] || "wrench";
      }
      if (decision.newInput) {
        targetStep.toolInput = decision.newInput;
      }
      break;

    case "try_fallback":
      targetStep.retryCount++;
      targetStep.status = "pending";
      targetStep.error = undefined;
      if (targetStep.fallbackTool) {
        targetStep.toolName = targetStep.fallbackTool;
        targetStep.label = `Trying ${targetStep.fallbackTool} (fallback)`;
        targetStep.icon = TOOL_ICONS[targetStep.fallbackTool] || "wrench";
      }
      if (targetStep.fallbackInput) {
        targetStep.toolInput = targetStep.fallbackInput;
      }
      break;

    case "skip_and_continue":
      targetStep.status = "skipped";
      break;

    case "abort":
      targetStep.status = "failed";
      break;
  }

  return {
    ...plan,
    phases: updatedPhases,
    adaptationHistory: [...plan.adaptationHistory, cycle],
    adaptationCount: plan.adaptationCount + 1,
    status: decision.strategy === "abort" ? "failed" : "adapting",
  };
}

export function getPlanStatus(plan: AdaptivePlan): {
  isComplete: boolean;
  isFailed: boolean;
  isPartial: boolean;
  progressPct: number;
  completedSteps: number;
  totalSteps: number;
  nextAction: string;
} {
  let completed = 0;
  let total = 0;
  let failed = 0;
  let skipped = 0;

  for (let p = 0; p <= plan.currentPhase; p++) {
    const phase = plan.phases[p];
    if (!phase) continue;
    for (const step of phase) {
      total++;
      if (step.status === "done") completed++;
      else if (step.status === "failed") failed++;
      else if (step.status === "skipped") skipped++;
    }
  }

  const isComplete = plan.currentPhase >= plan.totalPhases - 1 &&
    plan.phases[plan.totalPhases - 1]?.every((s) => s.status === "done" || s.status === "skipped");
  const isFailed = plan.status === "failed";
  const isPartial = !isComplete && !isFailed && (completed > 0 || skipped > 0);

  return {
    isComplete,
    isFailed,
    isPartial,
    progressPct: total > 0 ? Math.round(((completed + skipped) / total) * 100) : 0,
    completedSteps: completed,
    totalSteps: total,
    nextAction: isComplete
      ? "Synthesizing response"
      : isFailed
        ? "Execution aborted"
        : plan.status === "adapting"
          ? `Adapting (cycle ${plan.adaptationCount}/${plan.maxAdaptations})`
          : `Executing phase ${plan.currentPhase + 1}/${plan.totalPhases}`,
  };
}
