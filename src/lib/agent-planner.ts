export type IntentType =
  | "deposit"
  | "withdraw"
  | "discover"
  | "portfolio"
  | "balance"
  | "market"
  | "price"
  | "risk"
  | "protocol_info"
  | "gas"
  | "quote"
  | "approval"
  | "greeting"
  | "unknown";

export type ParsedIntent = {
  type: IntentType;
  confidence: number;
  extracted: {
    protocol?: string;
    asset?: string;
    amount?: string;
    token?: string;
    position_id?: string;
    min_apy?: number;
    max_risk?: string;
    time_horizon?: string;
    spender?: string;
  };
};

export type FlowStep = {
  toolName: string;
  toolInput: Record<string, unknown>;
  label: string;
  icon: string;
  requiredForFlow: boolean;
  skipIfCached: boolean;
  cacheKey?: string;
};

export type ExecutionPlan = {
  intent: ParsedIntent;
  steps: FlowStep[][];
  description: string;
  isDeterministic: boolean;
};

const PROTOCOL_ALIASES: Record<string, string> = {
  aave: "aave",
  "aave v3": "aave",
  aavev3: "aave",
  compound: "compound",
  "compound v3": "compound",
  compoundv3: "compound",
  morpho: "morpho",
  "morpho blue": "morpho",
  yearn: "yearn",
  uniswap: "uniswap",
  curve: "curve",
  lido: "lido",
  euler: "euler",
  yo: "yo protocol",
  "yo protocol": "yo protocol",
};

const ASSET_ALIASES: Record<string, string> = {
  usdc: "USDC",
  usdt: "USDT",
  eth: "ETH",
  weth: "WETH",
  wbtc: "WBTC",
  steth: "stETH",
};

function normalizeProtocol(raw: string): string {
  const cleaned = raw.toLowerCase().trim();
  return PROTOCOL_ALIASES[cleaned] || cleaned;
}

function normalizeAsset(raw: string): string {
  const cleaned = raw.toUpperCase().trim();
  return ASSET_ALIASES[cleaned.toLowerCase()] || cleaned;
}

function extractAmount(text: string): string | undefined {
  const patterns = [
    /(\d+\.?\d*)\s*(USDC|USDT|ETH|WETH|WBTC|stETH)/i,
    /(\d+\.?\d*)\s*(dollars?|\$)/i,
    /(deposit|invest|put|send)\s+(\d+\.?\d*)/i,
    /(\d+\.?\d*)\s*(to|into)/i,
    /^(\d+\.?\d*)$/i,
  ];
  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) return match[1];
  }
  return undefined;
}

function parseIntent(goal: string): ParsedIntent {
  const lower = goal.toLowerCase().trim();
  const extracted: ParsedIntent["extracted"] = {};

  for (const [alias, normal] of Object.entries(PROTOCOL_ALIASES)) {
    if (lower.includes(alias)) {
      extracted.protocol = normal;
      break;
    }
  }

  for (const [alias, normal] of Object.entries(ASSET_ALIASES)) {
    if (lower.includes(alias)) {
      extracted.asset = normal;
      break;
    }
  }

  extracted.amount = extractAmount(goal);

  const timeHorizonMatch = lower.match(/(short|medium|long)\s*term/);
  if (timeHorizonMatch) extracted.time_horizon = timeHorizonMatch[1];

  const riskMatch = lower.match(/(low|medium|high)\s*risk/);
  if (riskMatch) extracted.max_risk = riskMatch[1];

  const apyMatch = lower.match(/(\d+)\s*%?\s*(apy|yield|min)/);
  if (apyMatch) extracted.min_apy = parseInt(apyMatch[1]);

  let type: IntentType = "unknown";
  let confidence = 0.3;

  if (/^(hi|hello|hey|yo|sup|gm|good morning|good afternoon|good evening|how are you|what's up)\b/.test(lower)) {
    return { type: "greeting", confidence: 0.99, extracted };
  }

  if (/deposit|invest|put.*into|send.*to|place.*in/i.test(lower)) {
    type = "deposit";
    confidence = extracted.protocol ? 0.95 : extracted.amount ? 0.85 : 0.7;
    if (!extracted.asset) extracted.asset = "USDC";
    if (!extracted.amount) extracted.amount = undefined;
  } else if (/withdraw|take out|remove|cash out|unstake/i.test(lower)) {
    type = "withdraw";
    confidence = 0.85;
  } else if (/yield|apy|earn|interest|best.*return|opportunit|find.*vault|where.*invest/i.test(lower)) {
    type = "discover";
    confidence = 0.9;
  } else if (/portfolio|position|holdings|my.*wallet|what.*do i have|my.*asset|where is my/i.test(lower)) {
    type = "portfolio";
    confidence = 0.9;
  } else if (/balance|how much.*(do i have|i own)|check.*balance/i.test(lower)) {
    type = "balance";
    confidence = 0.85;
  } else if (/market|overview|snapshot|what.*happen/i.test(lower)) {
    type = "market";
    confidence = 0.8;
  } else if (/price|eth price|usdc.*price|token.*value|how much.*(is|worth).*(eth|usdc|btc)/i.test(lower)) {
    type = "price";
    confidence = 0.85;
  } else if (/risk|safe|danger|secure|risk.*score/i.test(lower)) {
    type = "risk";
    confidence = 0.8;
  } else if (/protocol info|about.*(aave|compound|morpho|uniswap|lido|yearn)|tell me about/i.test(lower)) {
    type = "protocol_info";
    confidence = 0.8;
  } else if (/gas|fee|cost|expensive/i.test(lower) && !/price/i.test(lower)) {
    type = "gas";
    confidence = 0.75;
  } else if (/quote|how.*much.*get|slippage|impact/i.test(lower)) {
    type = "quote";
    confidence = 0.75;
  } else if (/approval|allowance|spend|permit/i.test(lower)) {
    type = "approval";
    confidence = 0.75;
  }

  return { type, confidence, extracted };
}

interface SessionCache {
  discoveries: Map<string, unknown>;
  positions: unknown | null;
  portfolio: unknown | null;
  balances: Map<string, unknown>;
  marketOverview: unknown | null;
  timestamp: number;
}

const sessionCaches = new Map<string, SessionCache>();

function getSessionCache(walletAddress: string): SessionCache {
  const key = walletAddress.toLowerCase();
  let cache = sessionCaches.get(key);
  if (!cache || Date.now() - cache.timestamp > 120_000) {
    cache = {
      discoveries: new Map(),
      positions: null,
      portfolio: null,
      balances: new Map(),
      marketOverview: null,
      timestamp: Date.now(),
    };
    sessionCaches.set(key, cache);
  }
  return cache;
}

export function getCachedDiscovery(walletAddress: string, key: string): unknown | undefined {
  return getSessionCache(walletAddress).discoveries.get(key);
}

export function setCachedDiscovery(walletAddress: string, key: string, data: unknown): void {
  getSessionCache(walletAddress).discoveries.set(key, data);
}

export function getCachedPositions(walletAddress: string): unknown | null {
  return getSessionCache(walletAddress).positions;
}

export function setCachedPositions(walletAddress: string, data: unknown): void {
  getSessionCache(walletAddress).positions = data;
}

export function getCachedBalance(walletAddress: string, token: string): unknown | undefined {
  return getSessionCache(walletAddress).balances.get(token.toUpperCase());
}

export function setCachedBalance(walletAddress: string, token: string, data: unknown): void {
  getSessionCache(walletAddress).balances.set(token.toUpperCase(), data);
}

function buildDepositFlow(
  intent: ParsedIntent,
  walletAddress: string,
  chain: string,
): ExecutionPlan {
  const { protocol, asset, amount } = intent.extracted;
  const parallelStep1: FlowStep[] = [];
  const sequentialSteps: FlowStep[][] = [];

  parallelStep1.push({
    toolName: "check_balance",
    toolInput: { chain, token: asset || "USDC", wallet_address: walletAddress },
    label: `Checking ${asset || "USDC"} balance`,
    icon: "wallet",
    requiredForFlow: true,
    skipIfCached: true,
    cacheKey: `balance_${asset || "USDC"}`,
  });

  const discCacheKey = `disc_${protocol || "all"}_${asset || "all"}`;
  parallelStep1.push({
    toolName: "discover_opportunities",
    toolInput: {
      chain,
      ...(protocol ? { protocol } : {}),
      ...(asset && !protocol ? { asset } : {}),
      limit: 15,
    },
    label: protocol
      ? `Finding ${protocol} opportunities`
      : asset
        ? `Finding ${asset} yield opportunities`
        : "Scanning DeFi protocols",
    icon: "magnifying-glass",
    requiredForFlow: true,
    skipIfCached: true,
    cacheKey: discCacheKey,
  });

  sequentialSteps.push([
    {
      toolName: "prepare_deposit",
      toolInput: {
        protocol: protocol || "",
        asset: asset || "USDC",
        amount: amount || "",
        chain,
        wallet_address: walletAddress,
      },
      label: `Preparing deposit${protocol ? ` into ${protocol}` : ""}${amount ? ` of ${amount} ${asset || "USDC"}` : ""}`,
      icon: "arrow-down",
      requiredForFlow: true,
      skipIfCached: false,
    },
  ]);

  return {
    intent,
    steps: [parallelStep1, ...sequentialSteps],
    description: `Deposit flow: check balance + discover → prepare deposit`,
    isDeterministic: !!protocol && !!amount,
  };
}

function buildWithdrawFlow(
  intent: ParsedIntent,
  walletAddress: string,
  chain: string,
): ExecutionPlan {
  const step1: FlowStep[] = [
    {
      toolName: "get_positions",
      toolInput: { wallet_address: walletAddress, chain },
      label: "Fetching your positions",
      icon: "wallet",
      requiredForFlow: true,
      skipIfCached: true,
      cacheKey: "positions",
    },
  ];

  const step2: FlowStep[] = [
    {
      toolName: "prepare_withdraw",
      toolInput: {
        position_id: intent.extracted.position_id || "",
        amount: intent.extracted.amount || "max",
        wallet_address: walletAddress,
      },
      label: `Preparing withdrawal${intent.extracted.amount ? ` of ${intent.extracted.amount}` : ""}`,
      icon: "arrow-up",
      requiredForFlow: true,
      skipIfCached: false,
    },
  ];

  return {
    intent,
    steps: [step1, step2],
    description: "Withdraw flow: get positions → prepare withdraw",
    isDeterministic: !!intent.extracted.position_id,
  };
}

function buildDiscoverFlow(
  intent: ParsedIntent,
  chain: string,
): ExecutionPlan {
  const { asset, protocol, min_apy, max_risk } = intent.extracted;

  return {
    intent,
    steps: [
      [
        {
          toolName: "discover_opportunities",
          toolInput: {
            chain,
            ...(asset ? { asset } : {}),
            ...(protocol ? { protocol } : {}),
            ...(min_apy ? { min_apy } : {}),
            ...(max_risk ? { max_risk } : {}),
            limit: 20,
          },
          label: protocol
            ? `Scanning ${protocol} yields`
            : asset
              ? `Scanning ${asset} opportunities`
              : "Scanning all DeFi yields",
          icon: "magnifying-glass",
          requiredForFlow: true,
          skipIfCached: true,
          cacheKey: `disc_${protocol || "all"}_${asset || "all"}`,
        },
      ],
    ],
    description: "Discover flow: scan opportunities once",
    isDeterministic: true,
  };
}

function buildPortfolioFlow(
  intent: ParsedIntent,
  walletAddress: string,
  chain: string,
): ExecutionPlan {
  return {
    intent,
    steps: [
      [
        {
          toolName: "get_portfolio_summary",
          toolInput: { wallet_address: walletAddress, chain },
          label: "Fetching portfolio summary",
          icon: "wallet",
          requiredForFlow: true,
          skipIfCached: true,
          cacheKey: "portfolio",
        },
      ],
    ],
    description: "Portfolio flow: get full snapshot",
    isDeterministic: true,
  };
}

function buildBalanceFlow(
  intent: ParsedIntent,
  walletAddress: string,
  chain: string,
): ExecutionPlan {
  const token = intent.extracted.token || intent.extracted.asset || "USDC";

  return {
    intent,
    steps: [
      [
        {
          toolName: "check_balance",
          toolInput: { chain, token, wallet_address: walletAddress },
          label: `Checking ${token} balance`,
          icon: "wallet",
          requiredForFlow: true,
          skipIfCached: true,
          cacheKey: `balance_${token}`,
        },
      ],
    ],
    description: "Balance flow: check single token",
    isDeterministic: true,
  };
}

function buildMarketFlow(chain: string): ExecutionPlan {
  return {
    intent: { type: "market", confidence: 0.9, extracted: {} },
    steps: [
      [
        {
          toolName: "get_market_overview",
          toolInput: {},
          label: "Getting market overview",
          icon: "activity",
          requiredForFlow: true,
          skipIfCached: true,
          cacheKey: "market",
        },
      ],
    ],
    description: "Market flow: overview snapshot",
    isDeterministic: true,
  };
}

function buildPriceFlow(intent: ParsedIntent): ExecutionPlan {
  const token = intent.extracted.token || intent.extracted.asset || "ETH";

  return {
    intent,
    steps: [
      [
        {
          toolName: "get_token_price",
          toolInput: { token },
          label: `Fetching ${token} price`,
          icon: "dollar",
          requiredForFlow: true,
          skipIfCached: false,
        },
      ],
    ],
    description: "Price flow: get token price",
    isDeterministic: true,
  };
}

function buildProtocolInfoFlow(intent: ParsedIntent): ExecutionPlan {
  const protocol = intent.extracted.protocol || "aave";

  return {
    intent,
    steps: [
      [
        {
          toolName: "get_protocol_info",
          toolInput: { protocol },
          label: `Looking up ${protocol}`,
          icon: "info",
          requiredForFlow: true,
          skipIfCached: false,
        },
      ],
    ],
    description: "Protocol info flow",
    isDeterministic: true,
  };
}

function buildGasFlow(chain: string): ExecutionPlan {
  return {
    intent: { type: "gas", confidence: 0.8, extracted: {} },
    steps: [
      [
        {
          toolName: "get_gas_estimate",
          toolInput: { chain },
          label: "Estimating gas costs",
          icon: "fuel",
          requiredForFlow: true,
          skipIfCached: true,
          cacheKey: "gas",
        },
      ],
    ],
    description: "Gas estimate flow",
    isDeterministic: true,
  };
}

function buildGenericLLMFlow(
  intent: ParsedIntent,
  walletAddress: string,
  chain: string,
): ExecutionPlan {
  return {
    intent,
    steps: [],
    description: "LLM-driven flow: letting AI decide tools",
    isDeterministic: false,
  };
}

export function planExecution(
  goal: string,
  walletAddress: string,
  chain: string = "base",
): ExecutionPlan {
  const intent = parseIntent(goal);

  switch (intent.type) {
    case "greeting":
      return { intent, steps: [], description: "Greeting - no tools needed", isDeterministic: true };

    case "deposit":
      return buildDepositFlow(intent, walletAddress, chain);

    case "withdraw":
      return buildWithdrawFlow(intent, walletAddress, chain);

    case "discover":
      return buildDiscoverFlow(intent, chain);

    case "portfolio":
      return buildPortfolioFlow(intent, walletAddress, chain);

    case "balance":
      return buildBalanceFlow(intent, walletAddress, chain);

    case "market":
      return buildMarketFlow(chain);

    case "price":
      return buildPriceFlow(intent);

    case "protocol_info":
      return buildProtocolInfoFlow(intent);

    case "gas":
      return buildGasFlow(chain);

    case "risk":
    case "quote":
    case "approval":
    case "unknown":
      return buildGenericLLMFlow(intent, walletAddress, chain);

    default:
      return buildGenericLLMFlow(intent, walletAddress, chain);
  }
}

export function shouldUseDeterministicFlow(plan: ExecutionPlan): boolean {
  return plan.isDeterministic && plan.steps.length > 0;
}

export function getToolsForIntent(intentType: IntentType): string[] {
  switch (intentType) {
    case "deposit":
      return ["check_balance", "discover_opportunities", "prepare_deposit"];
    case "withdraw":
      return ["get_positions", "prepare_withdraw"];
    case "discover":
      return ["discover_opportunities"];
    case "portfolio":
      return ["get_portfolio_summary"];
    case "balance":
      return ["check_balance"];
    case "market":
      return ["get_market_overview"];
    case "price":
      return ["get_token_price"];
    case "protocol_info":
      return ["get_protocol_info"];
    case "gas":
      return ["get_gas_estimate"];
    case "risk":
      return ["analyze_risk", "get_portfolio_summary"];
    case "quote":
      return ["get_quote"];
    case "approval":
      return ["check_approval"];
    default:
      return ["discover_opportunities", "get_portfolio_summary"];
  }
}
