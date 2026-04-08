import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { tools } from "@/lib/claude";

const anthropic = new Anthropic();

const MAX_TOOL_ROUNDS = 10;

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "discover_opportunities": {
      const chain = input.chain as string | undefined;
      const minApy = input.min_apy as number | undefined;
      const maxRisk = input.max_risk as string | undefined;
      const protocol = input.protocol as string | undefined;

      return JSON.stringify({
        opportunities: [
          {
            protocol: "Aave V3",
            pool: "USDC Pool",
            chain: chain || "ethereum",
            asset: "USDC",
            apy: minApy && minApy > 4.5 ? 5.2 : 4.5,
            tvl: "$1.2B",
            risk_level: "low",
            pool_address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
          },
          {
            protocol: "Compound V3",
            pool: "USDC Market",
            chain: chain || "ethereum",
            asset: "USDC",
            apy: 4.8,
            tvl: "$800M",
            risk_level: "low",
            pool_address: "0xc3d688B66703497DAA1929EED142621a84e5aF69",
          },
          {
            protocol: "Uniswap V3",
            pool: "USDC/ETH",
            chain: chain || "ethereum",
            asset: "USDC-ETH LP",
            apy: 12.5,
            tvl: "$450M",
            risk_level:
              maxRisk === "low" ? undefined : maxRisk || "medium",
            pool_address: "0x88e6A0c2dDD261eEb0B33e1451bL8a0CfA4E9C37",
          },
          {
            protocol: "Lido",
            pool: "stETH",
            chain: chain || "ethereum",
            asset: "stETH",
            apy: 3.1,
            tvl: "$28B",
            risk_level: "low",
            pool_address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
          },
        ].filter((op) => op.risk_level !== undefined),
      });
    }

    case "get_quote": {
      const action = input.action as string;
      const amount = input.amount as string;
      const asset = input.asset as string;

      const numAmount = parseFloat(amount);
      const isDeposit = action === "deposit";
      const feeRate = 0.001;
      const fee = (numAmount * feeRate).toFixed(2);

      return JSON.stringify({
        action,
        asset,
        amount_in: amount,
        expected_amount_out: isDeposit
          ? (numAmount * 1.045).toFixed(2)
          : (numAmount * 0.99).toFixed(2),
        estimated_apy: isDeposit ? "4.5%" : "N/A",
        gas_estimate: "0.00085 ETH (~$2.80)",
        slippage: "< 0.01%",
        fee: `$${fee}`,
        price_impact: "< 0.05%",
        valid_for_seconds: 30,
      });
    }

    case "get_positions": {
      const walletAddress = input.wallet_address as string;

      return JSON.stringify({
        wallet_address: walletAddress,
        total_value: "$24,532.67",
        positions: [
          {
            protocol: "Aave V3",
            pool: "USDC Pool",
            chain: "ethereum",
            asset: "aUSDC",
            deposited: "10,000 USDC",
            current_value: "$10,450.00",
            unrealized_pnl: "+$450.00 (+4.5%)",
            entry_apy: "4.5%",
            time_weighted_return: "+$127.30",
            days_active: 45,
          },
          {
            protocol: "Lido",
            pool: "stETH",
            chain: "ethereum",
            asset: "stETH",
            deposited: "5.0 ETH",
            current_value: "$14,082.67",
            unrealized_pnl: "+$82.67 (+0.59%)",
            entry_apy: "3.1%",
            time_weighted_return: "+$42.15",
            days_active: 14,
          },
        ],
      });
    }

    case "analyze_risk": {
      const positions = input.positions as Array<Record<string, unknown>> | undefined;
      const timeHorizon = input.time_horizon as string | undefined;

      const positionCount = positions?.length ?? 2;
      const concentration =
        positionCount === 1 ? "high" : positionCount <= 3 ? "medium" : "low";

      return JSON.stringify({
        overall_score: 72,
        score_label: "Moderate Risk",
        time_horizon: timeHorizon || "medium",
        breakdown: {
          smart_contract_risk: { score: 85, level: "Low", details: "Top-tier protocols with extensive audits" },
          impermanent_loss: { score: 90, level: "Very Low", details: "No LP positions detected" },
          liquidation_risk: { score: 75, level: "Low", details: "Healthy collateral ratios across all positions" },
          protocol_concentration: {
            score: concentration === "high" ? 40 : concentration === "medium" ? 60 : 80,
            level: concentration === "high" ? "High" : concentration === "medium" ? "Medium" : "Low",
            details: `Across ${positionCount} protocols`,
          },
          market_risk: { score: 65, level: "Medium", details: "Exposure to single-asset volatility" },
        },
        recommendations: [
          "Consider diversifying across additional chains to reduce L1-specific risks",
          "Current stablecoin-heavy allocation provides good downside protection",
          "Monitor Aave health factors if planning to add leveraged positions",
        ],
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { goal, wallet_address } = body;

    if (!goal || !wallet_address) {
      return NextResponse.json(
        { error: "Missing required fields: goal and wallet_address" },
        { status: 400 },
      );
    }

    const systemPrompt = `You are YieldMind, an expert DeFi yield optimization agent. Your job is to help users maximize their yield while managing risk appropriately.

When the user gives you a goal, you should:
1. Use discover_opportunities to find relevant yield opportunities
2. Use get_positions to understand their current portfolio
3. Use get_quote to get specific deposit/withdrawal quotes when needed
4. Use analyze_risk to evaluate the risk profile of any recommendation

Always base your recommendations on actual tool results. Be specific about amounts, APYs, protocols, and risks.
Format your final response as a clear recommendation with:
- Summary of what you recommend
- Specific actions to take (which protocol, how much, expected APY)
- Risk assessment
- Step-by-step instructions

If you need more information from the user, ask for it before making assumptions.`;

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `My goal: ${goal}\nMy wallet address: ${wallet_address}`,
      },
    ];

    let round = 0;
    let finalMessage: Anthropic.TextBlockParam | null = null;

    while (round < MAX_TOOL_ROUNDS) {
      round++;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools: tools as unknown as Anthropic.Tool[],
        messages,
      });

      const contentBlocks = response.content;

      const toolUseBlocks = contentBlocks.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );
      const textBlocks = contentBlocks.filter(
        (block): block is Anthropic.TextBlock => block.type === "text",
      );

      if (toolUseBlocks.length === 0) {
        finalMessage = textBlocks[0] ?? null;
        break;
      }

      messages.push({
        role: "assistant",
        content: contentBlocks,
      });

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (toolBlock) => {
          const result = await executeTool(toolBlock.name, toolBlock.input as Record<string, unknown>);
          return {
            type: "tool_result" as const,
            tool_use_id: toolBlock.id,
            content: result,
          };
        }),
      );

      messages.push({ role: "user", content: toolResults });
    }

    const recommendation = finalMessage?.text ?? "Unable to generate a recommendation. Please try again.";

    return NextResponse.json({
      recommendation,
      rounds_used: round,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Agent loop error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
