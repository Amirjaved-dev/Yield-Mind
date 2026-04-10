export const tools = [
  {
    type: "function",
    function: {
      name: "check_balance",
      description:
        "MANDATORY FIRST STEP before any deposit. Checks user's token balance on a specific chain. Returns exact balance, USD value, and whether sufficient for planned transaction. Always call this before suggesting or preparing deposits.",
      parameters: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            description:
              "Blockchain network: ethereum, arbitrum, optimism, base, polygon, avalanche, bnb, solana",
          },
          token: {
            type: "string",
            description:
              "Token symbol (USDC, USDT, ETH, WETH, WBTC, etc.) or contract address",
          },
          wallet_address: {
            type: "string",
            description: "User's wallet address (0x...)",
          },
        },
        required: ["chain", "token", "wallet_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_approval",
      description:
        "Checks if token is approved for spending by a protocol. Call before prepare_deposit to determine if approval transaction is needed. Returns current allowance and approval requirement status.",
      parameters: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            description: "Blockchain network",
          },
          token: {
            type: "string",
            description: "Token symbol to check approval for",
          },
          wallet_address: {
            type: "string",
            description: "User's wallet address",
          },
          spender: {
            type: "string",
            description:
              "Protocol contract address that needs approval (e.g., Aave pool, Compound comptroller)",
          },
        },
        required: ["chain", "token", "wallet_address", "spender"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "discover_opportunities",
      description:
        "CORE DISCOVERY TOOL. Scans DeFi protocols to find yield opportunities. Use for any yield discovery, comparison, or optimization request. Returns pools with APY, TVL, risk metrics, and protocol details. Supports filtering by chain, asset, protocol, risk level, and sorting options.",
      parameters: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            description:
              "Filter by blockchain: ethereum, arbitrum, optimism, base, polygon, avalanche, bnb, solana. Omit for cross-chain scan.",
          },
          asset: {
            type: "string",
            description:
              "Filter by asset symbol (USDC, ETH, WETH, WBTC, stETH, etc.)",
          },
          protocol: {
            type: "string",
            description:
              "Filter by protocol: aave, compound, uniswap, curve, lido, rocket-pool, gmx, yearn, convex, aura, euler, morpho",
          },
          min_apy: {
            type: "number",
            description: "Minimum APY threshold (e.g., 5 for 5% APY)",
          },
          max_risk: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Maximum acceptable risk level",
          },
          sort_by: {
            type: "string",
            enum: ["apy", "tvl", "risk"],
            description:
              "Sort results: apy (highest first), tvl (largest first), risk (lowest first)",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default: 20, max: 50)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_positions",
      description:
        "RETRIEVES USER'S DEFI POSITIONS. Essential for portfolio analysis, withdrawal planning, and avoiding duplicate positions. Returns all yield positions across protocols with values, APYs, and PnL. Always call before recommending new positions to assess portfolio composition.",
      parameters: {
        type: "object",
        properties: {
          wallet_address: {
            type: "string",
            description: "User's wallet address",
          },
          chain: {
            type: "string",
            description: "Filter by specific chain (optional)",
          },
          protocols: {
            type: "array",
            items: { type: "string" },
            description:
              "Filter by protocols: ['aave', 'compound', 'lido', 'uniswap', etc.]",
          },
          include_history: {
            type: "boolean",
            description: "Include transaction history for each position",
          },
        },
        required: ["wallet_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_quote",
      description:
        "Gets detailed quote for deposit/withdrawal action. Returns expected amounts, slippage, price impact, and execution details. Use when user specifies exact amounts for precise planning.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["deposit", "withdraw"],
            description: "Action type",
          },
          amount: {
            type: "string",
            description: "Amount to deposit/withdraw in human format (e.g., '1000')",
          },
          asset: {
            type: "string",
            description: "Token symbol or address",
          },
          pool_address: {
            type: "string",
            description: "Target pool contract address",
          },
          chain: {
            type: "string",
            description: "Blockchain network",
          },
          slippage_tolerance: {
            type: "string",
            description: "Max slippage as decimal (e.g., '0.005' for 0.5%)",
          },
        },
        required: ["action", "pool_address", "amount", "asset"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_risk",
      description:
        "CRITICAL RISK ASSESSMENT. Analyzes risk profile of positions or portfolio. Evaluates: smart contract risk, protocol concentration, oracle dependency, liquidation risk, impermanent loss exposure. Returns risk score (0-100) with detailed breakdown. Always use before recommending new positions.",
      parameters: {
        type: "object",
        properties: {
          positions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                protocol: { type: "string" },
                asset: { type: "string" },
                amount: { type: "string" },
                chain: { type: "string" },
                pool_address: { type: "string" },
              },
            },
            description:
              "Positions to analyze. Each position: { protocol, asset, amount, chain, pool_address? }",
          },
          time_horizon: {
            type: "string",
            enum: ["short", "medium", "long"],
            description:
              "Investment horizon: short (<1 week), medium (<3 months), long (>3 months)",
          },
          include_oracle_risk: {
            type: "boolean",
            description: "Include oracle manipulation risk analysis",
          },
          check_onchain: {
            type: "boolean",
            description: "Verify positions on-chain for additional security",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_token_price",
      description:
        "Gets current USD price for any token. Use for: portfolio valuation, calculating transaction values, comparing opportunities. Supports major tokens and chain-specific tokens.",
      parameters: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "Token symbol (ETH, USDC, WBTC, stETH, etc.) or address",
          },
          chain: {
            type: "string",
            description:
              "Blockchain network. Required if using token address instead of symbol.",
          },
        },
        required: ["token"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_protocol_info",
      description:
        "DETAILED PROTOCOL INTELLIGENCE. Returns: security audits, TVL history, supported chains, risk assessments, team info, governance details, historical incidents. ESSENTIAL before recommending any protocol. Use to assess protocol safety and reliability.",
      parameters: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description:
              "Protocol name: aave, compound, uniswap, curve, lido, gmx, yearn, euler, morpho, rocket-pool, etc.",
          },
          include_audits: {
            type: "boolean",
            description: "Include detailed security audit information",
          },
          include_tvl_history: {
            type: "boolean",
            description: "Include TVL history and trends",
          },
        },
        required: ["protocol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_gas_estimate",
      description:
        "Estimates gas costs for transactions. Use before any deposit/withdrawal to calculate total costs. Returns gas price in gwei and estimated USD cost. Essential for cost-benefit analysis of yield opportunities.",
      parameters: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            description: "Blockchain network",
          },
          action: {
            type: "string",
            enum: ["deposit", "withdraw", "approve", "swap", "transfer"],
            description: "Type of action to estimate",
          },
        },
        required: ["chain"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_deposit",
      description:
        "PREPARES DEPOSIT TRANSACTION. Returns transaction preview with: estimated APY, gas costs, approval requirements, and transaction data. MUST call this before execute_deposit. Shows user exactly what will happen. STOP after this and await user confirmation.",
      parameters: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description:
              "Target protocol: aave, aave-v3, compound, compound-v3, euler, morpho, yearn",
          },
          asset: {
            type: "string",
            description: "Asset to deposit: USDC, USDT, ETH, WETH, WBTC, stETH",
          },
          amount: {
            type: "string",
            description: "Amount to deposit in human format (e.g., '1000' for 1000 USDC)",
          },
          chain: {
            type: "string",
            description: "Blockchain network",
          },
          wallet_address: {
            type: "string",
            description: "User's wallet address",
          },
        },
        required: ["protocol", "asset", "amount", "chain", "wallet_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_withdraw",
      description:
        "PREPARES WITHDRAWAL TRANSACTION. Returns withdrawal preview with amounts, gas costs, and transaction data. MUST call before execute_withdraw. Shows user exactly what will be withdrawn. STOP after this and await user confirmation.",
      parameters: {
        type: "object",
        properties: {
          position_id: {
            type: "string",
            description:
              "Position identifier (format: 'protocol-chain-asset', e.g., 'aave-v3-arbitrum-usdc')",
          },
          amount: {
            type: "string",
            description:
              "Amount to withdraw in human format. Use 'max' for full withdrawal.",
          },
          wallet_address: {
            type: "string",
            description: "User's wallet address",
          },
        },
        required: ["position_id", "amount", "wallet_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_deposit",
      description:
        "EXECUTES DEPOSIT TRANSACTION. ONLY call after: 1) check_balance verified funds, 2) prepare_deposit shown preview, 3) user explicitly confirmed. Returns transaction data for wallet signing. user_confirmation MUST be true.",
      parameters: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description: "Target protocol",
          },
          asset: {
            type: "string",
            description: "Asset to deposit",
          },
          amount: {
            type: "string",
            description: "Amount to deposit",
          },
          chain: {
            type: "string",
            description: "Blockchain network",
          },
          wallet_address: {
            type: "string",
            description: "User's wallet address",
          },
          user_confirmation: {
            type: "boolean",
            description:
              "MUST be true. Indicates user has seen preview and explicitly confirmed this exact transaction.",
          },
        },
        required: [
          "protocol",
          "asset",
          "amount",
          "chain",
          "wallet_address",
          "user_confirmation",
        ],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_withdraw",
      description:
        "EXECUTES WITHDRAWAL TRANSACTION. ONLY call after: 1) prepare_withdraw shown preview, 2) user explicitly confirmed. Returns transaction data for wallet signing. user_confirmation MUST be true.",
      parameters: {
        type: "object",
        properties: {
          position_id: {
            type: "string",
            description: "Position identifier to withdraw from",
          },
          amount: {
            type: "string",
            description: "Amount to withdraw. Use 'max' for full withdrawal.",
          },
          wallet_address: {
            type: "string",
            description: "User's wallet address",
          },
          user_confirmation: {
            type: "boolean",
            description:
              "MUST be true. Indicates user has seen preview and explicitly confirmed.",
          },
        },
        required: ["position_id", "amount", "wallet_address", "user_confirmation"],
      },
    },
  },
] as const;
