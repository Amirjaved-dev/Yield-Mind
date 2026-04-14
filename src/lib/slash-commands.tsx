import React from "react";
import {
  Wallet,
  Search,
  Shield,
  Calculator,
  Zap,
  Check,
  TrendingUp,
  DollarSign,
  Info,
  Fuel,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  HelpCircle,
  Gauge,
  ListChecks,
} from "lucide-react";

export type SlashCommandResult =
  | { type: "message"; title: string; content: string }
  | { type: "action"; action: "clear" }
  | null;

export interface SlashCommand {
  name: string;
  description: string;
  icon: React.ElementType;
  category: "tools" | "system" | "info";
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "tools",
    description: "List all 15 agent tools with descriptions & usage",
    icon: ListChecks,
    category: "tools",
  },
  {
    name: "skill",
    description: "Show tool efficiency rules (selection, caching, batching)",
    icon: Gauge,
    category: "tools",
  },
  {
    name: "help",
    description: "Show all available commands",
    icon: HelpCircle,
    category: "info",
  },
  {
    name: "clear",
    description: "Clear current conversation",
    icon: Trash2,
    category: "system",
  },
];

const TOOLS_DATA = [
  {
    name: "get_portfolio_summary",
    description: "Full wallet snapshot: balances, positions, total value, chains, protocols",
    icon: Wallet,
    category: "Read",
    cached: "30s",
    parallel: true,
  },
  {
    name: "get_market_overview",
    description: "Market snapshot: ETH price, gas costs, top DeFi yields",
    icon: Zap,
    category: "Read",
    cached: "2min",
    parallel: true,
  },
  {
    name: "check_balance",
    description: "Single token balance with USD value and decimals",
    icon: Wallet,
    category: "Read",
    cached: "15s",
    parallel: true,
  },
  {
    name: "check_approval",
    description: "Check if token is approved for a protocol spender contract",
    icon: Check,
    category: "Read",
    cached: "No",
    parallel: true,
  },
  {
    name: "discover_opportunities",
    description: "All DeFi yield opportunities matching filters. One call returns everything.",
    icon: Search,
    category: "Read",
    cached: "60s",
    parallel: true,
  },
  {
    name: "get_positions",
    description: "User's DeFi positions across protocols with values, APYs, IDs",
    icon: Wallet,
    category: "Read",
    cached: "30s",
    parallel: true,
  },
  {
    name: "get_quote",
    description: "Deposit/withdrawal quote: amounts, slippage, gas, impact",
    icon: Calculator,
    category: "Read",
    cached: "15s",
    parallel: true,
  },
  {
    name: "analyze_risk",
    description: "Risk score (0-100) with 6-dimension breakdown for given positions",
    icon: Shield,
    category: "Compute",
    cached: "No",
    parallel: false,
  },
  {
    name: "get_token_price",
    description: "Current USD price and 24h change for any token",
    icon: DollarSign,
    category: "Read",
    cached: "60s",
    parallel: true,
  },
  {
    name: "get_protocol_info",
    description: "Protocol details: audits, TVL, chains, hack history, risk score",
    icon: Info,
    category: "Read",
    cached: "5min",
    parallel: true,
  },
  {
    name: "get_gas_estimate",
    description: "Current gas price in gwei and estimated USD cost per action type",
    icon: Fuel,
    category: "Read",
    cached: "30s",
    parallel: true,
  },
  {
    name: "prepare_deposit",
    description: "Build deposit tx data. Returns preview, APY, gas, approval needs.",
    icon: ArrowDownToLine,
    category: "Write-prep",
    cached: "No",
    parallel: false,
  },
  {
    name: "prepare_withdraw",
    description: "Build withdrawal tx data. Returns preview, gas, current value.",
    icon: ArrowUpFromLine,
    category: "Write-prep",
    cached: "No",
    parallel: false,
  },
  {
    name: "build_transaction_deposit",
    description: "Final deposit step. Passes tx to UI for wallet signing. Requires user confirm.",
    icon: ArrowDownToLine,
    category: "Write-tx",
    cached: "No",
    parallel: false,
  },
  {
    name: "build_transaction_withdraw",
    description: "Final withdraw step. Passes tx to UI for wallet signing. Requires user confirm.",
    icon: ArrowUpFromLine,
    category: "Write-tx",
    cached: "No",
    parallel: false,
  },
];

const bt = "`";

function generateToolsContent(): string {
  const header = "## All 15 YieldMind Agent Tools\n\n";
  const byCategory = TOOLS_DATA.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, typeof TOOLS_DATA>);

  let body = "";
  for (const [category, tools] of Object.entries(byCategory)) {
    body += "\n### " + category + "\n\n";
    body += "| Tool | Description | Cache | Parallel |\n";
    body += "|------|-------------|-------|----------|\n";
    for (const t of tools) {
      body += "| " + bt + t.name + bt + " | " + t.description + " | " + t.cached + " | " + (t.parallel ? "Yes" : "After deps") + " |\n";
    }
    body += "\n";
  }

  body += "\n### Quick Rules\n\n";
  body += "- **Portfolio?** Use " + bt + "get_portfolio_summary" + bt + " \u2014 never call check_balance + get_positions separately\n";
  body += "- **Yields?** Call " + bt + "discover_opportunities" + bt + " ONCE with no asset filter \u2014 it returns everything\n";
  body += "- **Deposit flow:** check_balance + discover_opportunities (parallel) \u2192 prepare_deposit \u2192 build_transaction_deposit\n";
  body += "- **Withdraw flow:** get_positions \u2192 prepare_withdraw \u2192 build_transaction_withdraw\n";
  body += "- **Never** call check_approval before prepare_deposit \u2014 it handles approval internally\n";

  return header + body;
}

function generateSkillContent(): string {
  return [
    "## Tool Efficiency Skill",
    "",
    "### 1. Selection Priority",
    "",
    "| Intent | Best Tool | Avoid |",
    "|--------|-----------|-------|",
    "| Portfolio | " + bt + "get_portfolio_summary" + bt + " | Multiple separate calls |",
    "| Yields | " + bt + "discover_opportunities" + bt + " (no filter) | Per-asset loops |",
    "| Single balance | " + bt + "check_balance" + bt + " | Full portfolio summary |",
    "| Risk | portfolio \u2192 " + bt + "analyze_risk" + bt + " | Positions alone |",
    "| Gas | " + bt + "get_gas_estimate" + bt + " | Parse from market overview |",
    "| Price | " + bt + "get_token_price" + bt + " | Parse from market overview |",
    "",
    "### 2. Parallel Batching",
    "",
    "**Batch together (Round 1):**",
    "- " + bt + "check_balance" + bt,
    "- " + bt + "discover_opportunities" + bt,
    "- " + bt + "get_market_overview" + bt,
    "- " + bt + "get_gas_estimate" + bt,
    "",
    "**Sequential (needs prior results):**",
    "- " + bt + "prepare_deposit" + bt + " (needs pool_address from discovery)",
    "- " + bt + "prepare_withdraw" + bt + " (needs position_id from get_positions)",
    "- " + bt + "build_transaction_*" + bt + " (needs user confirmation)",
    "",
    "### 3. Cache Awareness",
    "",
    "| Data | TTL | Respect cache? |",
    "|------|-----|----------------|",
    "| Token Price | 60s | Always |",
    "| Protocol Info | 5min | Always |",
    "| Market Overview | 2min | Always |",
    "| Opportunities | 60s | Always |",
    "| Balances | 15s | Skip after tx |",
    "| Positions | 30s | Skip after tx |",
    "| Prepare Deposit/Withdraw | Never | Always fresh |",
    "",
    "### 4. Error Handling",
    "",
    "**Non-retryable (stop):** not deployed, not found, Unsupported, Invalid, Failed to encode",
    "",
    "**Retryable (once):** HTTP 429/500/503, DeFi Llama timeout (try LI.FI fallback)",
    "",
    "### 5. Result Truncation",
    "",
    "- Discovery: top 7 rows only",
    "- Positions: display fields only",
    "- Everything else: 4000 char hard cap",
    "",
    "### 6. Deterministic vs LLM Flow",
    "",
    "**Deterministic (hardcoded plan):** deposit, withdraw, discover, portfolio, balance, market, price, protocol_info, gas",
    "",
    "**LLM-driven (let AI decide):** risk, quote, approval, unknown intents",
    "",
    "### 7. State Machine Phases",
    "",
    "idle \u2192 discovery \u2192 comparison \u2192 ready \u2192 executing \u2192 completed",
    "",
    "Each phase restricts which tools are safe to call.",
  ].join("\n");
}

function generateHelpContent(): string {
  const header = "## Available Commands\n\n";
  let body = "| Command | Description |\n|---------|-------------|\n";
  for (const cmd of SLASH_COMMANDS) {
    body += "| **" + cmd.name + "** | " + cmd.description + " |\n";
  }
  body += "\nType " + bt + "/" + bt + " in the input bar to see available commands.\n";
  return header + body;
}

export function executeSlashCommand(input: string): SlashCommandResult {
  const trimmed = input.trim();

  if (trimmed === "/tools") {
    return { type: "message", title: "Agent Tools Reference", content: generateToolsContent() };
  }

  if (trimmed === "/skill") {
    return { type: "message", title: "Tool Efficiency Skill", content: generateSkillContent() };
  }

  if (trimmed === "/help") {
    return { type: "message", title: "Help", content: generateHelpContent() };
  }

  if (trimmed === "/clear") {
    return { type: "action", action: "clear" };
  }

  return null;
}

export function isSlashCommand(input: string): boolean {
  return /^\s*\/[a-zA-Z]/.test(input);
}

export function getMatchingCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase().replace(/^\//, "").trim();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => c.name.includes(q) || c.description.toLowerCase().includes(q));
}
