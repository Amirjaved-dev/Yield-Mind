export const tools = [
  {
    type: "function",
    function: {
      name: "check_balance",
      description:
        "Check the user's token balance on a specific chain. Use this before suggesting deposits to verify the user has sufficient funds. Returns balance in both raw and formatted amounts, plus USD value.",
      parameters: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            description: "Blockchain network (e.g., ethereum, arbitrum, base)",
          },
          token: {
            type: "string",
            description: "Token symbol (e.g., USDC, ETH, WETH)",
          },
          wallet_address: {
            type: "string",
            description: "User's wallet address",
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
        "Check if a token is approved for spending by a protocol. Returns the current allowance and whether approval is needed before depositing.",
      parameters: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            description: "Blockchain network (e.g., ethereum, arbitrum)",
          },
          token: {
            type: "string",
            description: "Token symbol (e.g., USDC, USDT)",
          },
          wallet_address: {
            type: "string",
            description: "User's wallet address",
          },
          spender: {
            type: "string",
            description: "The protocol address that needs approval (e.g., Aave pool address)",
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
        "Discover yield opportunities across DeFi protocols. Returns a list of available pools, APYs, TVL, and risk metrics for various lending and liquidity protocols.",
      parameters: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            description:
              "Filter by blockchain network (e.g., ethereum, arbitrum, optimism, base, polygon, avalanche, bnb)",
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
              "Filter by specific protocol (e.g., aave, compound, uniswap, lido)",
          },
          sort_by: {
            type: "string",
            enum: ["apy", "tvl", "risk"],
            description: "Sort results by APY (highest), TVL (largest), or risk (lowest first)",
          },
          asset: {
            type: "string",
            description: "Filter by asset symbol (e.g., USDC, ETH, WETH)",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 20, max: 50)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_quote",
      description:
        "Get a quote for depositing or withdrawing assets from a yield pool. Returns expected amounts, gas estimates, slippage, and execution details.",
      parameters: {
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
          chain: {
            type: "string",
            description: "The blockchain network (e.g., ethereum, arbitrum)",
          },
          slippage_tolerance: {
            type: "string",
            description: "Maximum acceptable slippage (e.g., '0.5' for 0.5%)",
          },
        },
        required: ["action", "pool_address", "amount", "asset"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_positions",
      description:
        "Retrieve the user's current yield positions across all protocols. Shows deposited amounts, current value, unrealized PnL, and time-weighted returns for each position.",
      parameters: {
        type: "object",
        properties: {
          wallet_address: {
            type: "string",
            description: "The user's wallet address to query positions for",
          },
          protocols: {
            type: "array",
            items: { type: "string" },
            description: "Filter by specific protocols (e.g., ['aave', 'compound', 'lido'])",
          },
          chain: {
            type: "string",
            description:
              "Optional filter by chain (e.g., ethereum, arbitrum, base)",
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
      name: "analyze_risk",
      description:
        "Analyze the risk profile of a yield position or portfolio. Evaluates smart contract risk, impermanent loss, liquidation risk, protocol concentration, and overall portfolio health score.",
      parameters: {
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
        "Get the current price of a token in USD. Supports major tokens and chain-specific tokens.",
      parameters: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "Token symbol (e.g., ETH, USDC, WBTC) or address",
          },
          chain: {
            type: "string",
            description: "Blockchain network (e.g., ethereum, arbitrum). Required if using address.",
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
        "Get detailed information about a DeFi protocol including security audits, TVL history, supported chains, and risk assessments.",
      parameters: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description: "Protocol name (e.g., aave, compound, lido, uniswap)",
          },
          include_audits: {
            type: "boolean",
            description: "Include security audit information",
          },
          include_tvl_history: {
            type: "boolean",
            description: "Include TVL history over time",
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
        "Get current gas price estimates for a specific chain and action. Returns gas price in gwei and estimated cost in USD.",
      parameters: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            description: "Blockchain network (e.g., ethereum, arbitrum, base)",
          },
          action: {
            type: "string",
            enum: ["deposit", "withdraw", "approve", "swap", "transfer"],
            description: "Type of action to estimate gas for",
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
        "Prepare a deposit transaction for execution. Returns transaction data including the encoded calldata, gas estimates, and whether approval is needed. Use this to show the user a preview before they confirm.",
      parameters: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description: "Target protocol (e.g., aave, aave-v3, compound, compound-v3)",
          },
          asset: {
            type: "string",
            description: "Asset to deposit (e.g., USDC, USDT, WETH)",
          },
          amount: {
            type: "string",
            description: "Amount to deposit in human-readable format (e.g., '1000' for 1000 USDC)",
          },
          chain: {
            type: "string",
            description: "Blockchain network (e.g., ethereum, arbitrum, base)",
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
        "Prepare a withdrawal transaction for execution. Returns transaction data including the encoded calldata and gas estimates. Use this to show the user a preview before they confirm.",
      parameters: {
        type: "object",
        properties: {
          position_id: {
            type: "string",
            description: "Identifier for the position to withdraw from (e.g., 'aave-v3-arbitrum-usdc')",
          },
          amount: {
            type: "string",
            description: "Amount to withdraw (e.g., '500'). Use 'max' for full withdrawal.",
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
        "Execute a deposit transaction into a yield pool. IMPORTANT: Only call this after the user has seen the preview and explicitly confirmed. Returns transaction data for wallet signing.",
      parameters: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description: "Target protocol (e.g., aave-v3, compound-v3)",
          },
          asset: {
            type: "string",
            description: "Asset to deposit (e.g., USDC, ETH)",
          },
          amount: {
            type: "string",
            description: "Amount to deposit in human-readable format (e.g., '1000' for 1000 USDC)",
          },
          chain: {
            type: "string",
            description: "Blockchain network (e.g., ethereum, arbitrum)",
          },
          wallet_address: {
            type: "string",
            description: "User's wallet address for transaction preparation",
          },
          user_confirmation: {
            type: "boolean",
            description: "Must be true - indicates user has confirmed this exact transaction",
          },
        },
        required: ["protocol", "asset", "amount", "chain", "wallet_address", "user_confirmation"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_withdraw",
      description:
        "Execute a withdrawal from a yield position. IMPORTANT: Only call this after the user has seen the preview and explicitly confirmed. Returns transaction data for wallet signing.",
      parameters: {
        type: "object",
        properties: {
          position_id: {
            type: "string",
            description: "Identifier for the position to withdraw from (protocol-chain-asset)",
          },
          amount: {
            type: "string",
            description: "Amount to withdraw (e.g., '500' for 500 USDC). Use 'max' for full withdrawal.",
          },
          wallet_address: {
            type: "string",
            description: "User's wallet address",
          },
          user_confirmation: {
            type: "boolean",
            description: "Must be true - indicates user has confirmed this exact withdrawal",
          },
        },
        required: ["position_id", "amount", "wallet_address", "user_confirmation"],
      },
    },
  },
] as const;
