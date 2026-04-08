export const tools = [
  {
    name: "discover_opportunities",
    description:
      "Discover yield opportunities across DeFi protocols. Returns a list of available pools, APYs, TVL, and risk metrics for various lending and liquidity protocols.",
    input_schema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          description:
            "Filter by blockchain network (e.g., ethereum, arbitrum, optimism, base, polygon)",
        },
        min_apy: {
          type: "number",
          description: "Minimum APY threshold to filter results",
        },
        max_risk: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Maximum risk level to include in results",
        },
        protocol: {
          type: "string",
          description:
            "Filter by specific protocol (e.g., aave, compound, unisave, lido)",
        },
      },
    },
  },
  {
    name: "get_quote",
    description:
      "Get a quote for depositing or withdrawing assets from a yield pool. Returns expected amounts, gas estimates, slippage, and execution details.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["deposit", "withdraw"],
          description: "Whether to deposit into or withdraw from a pool",
        },
        pool_address: {
          type: "string",
          description: "The address of the target yield pool",
        },
        amount: {
          type: "string",
          description: "The amount of the asset to deposit or withdraw",
        },
        asset: {
          type: "string",
          description: "The token symbol or address (e.g., USDC, ETH, WETH)",
        },
        slippage_tolerance: {
          type: "string",
          description: "Maximum acceptable slippage (e.g., '0.5' for 0.5%)",
        },
      },
      required: ["action", "pool_address", "amount", "asset"],
    },
  },
  {
    name: "get_positions",
    description:
      "Retrieve the user's current yield positions across all protocols. Shows deposited amounts, current value, unrealized PnL, and time-weighted returns for each position.",
    input_schema: {
      type: "object",
      properties: {
        wallet_address: {
          type: "string",
          description: "The user's wallet address to query positions for",
        },
        protocol: {
          type: "string",
          description:
            "Optional filter by protocol (e.g., aave, compound, unisave)",
        },
        chain: {
          type: "string",
          description:
            "Optional filter by chain (e.g., ethereum, arbitrum, base)",
        },
      },
      required: ["wallet_address"],
    },
  },
  {
    name: "analyze_risk",
    description:
      "Analyze the risk profile of a yield position or portfolio. Evaluates smart contract risk, impermanent loss, liquidation risk, protocol concentration, and overall portfolio health score.",
    input_schema: {
      type: "object",
      properties: {
        positions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pool_address: { type: "string" },
              protocol: { type: "string" },
              amount: { type: "string" },
              asset: { type: "string" },
              chain: { type: "string" },
            },
          },
          description:
            "Array of positions to analyze. Each position includes pool_address, protocol, amount, asset, and chain.",
        },
        wallet_address: {
          type: "string",
          description:
            "Optional wallet address to auto-fetch positions instead of providing them manually",
        },
        time_horizon: {
          type: "string",
          enum: ["short", "medium", "long"],
          description:
            "Investment time horizon which affects risk scoring (short < 1 week, medium < 3 months, long > 3 months)",
        },
      },
    },
  },
] as const;
