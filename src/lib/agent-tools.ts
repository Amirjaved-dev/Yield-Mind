export const tools = [
  {
    type: "function",
    function: {
      name: "get_portfolio_summary",
      description:
        "Returns wallet's complete portfolio in one call: all token balances with USD values, all DeFi positions, total value, chains, and protocols. Use this instead of calling check_balance and get_positions separately.",
      parameters: {
        type: "object",
        properties: {
          wallet_address: {
            type: "string",
            description: "User's wallet address (0x...)",
          },
          chain: {
            type: "string",
            description: "Chain to query (default: base)",
          },
        },
        required: ["wallet_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_market_overview",
      description:
        "Returns current market snapshot: ETH price, Base gas costs, and top DeFi yield opportunities. Use for quick market context or when user asks about current conditions.",
      parameters: {
        type: "object",
        properties: {
          asset: {
            type: "string",
            description: "Filter opportunities by asset (USDC, ETH, WBTC, etc.)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_balance",
      description:
        "Returns token balance, USD value, and decimals for a specific token on a chain.",
      parameters: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            description: "Blockchain network (e.g., base)",
          },
          token: {
            type: "string",
            description: "Token symbol (USDC, USDT, ETH, WETH, WBTC, etc.) or contract address",
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
        "Returns whether a token is approved for spending by a given protocol contract address, and the current allowance amount.",
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
            description: "Protocol contract address that needs approval",
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
        "Returns ALL DeFi yield opportunities matching your filters in a SINGLE call. Each result includes protocol, APY, TVL, risk_level, pool_address, and asset. Results are Base-only by default. IMPORTANT: Call this ONCE without an asset filter to get all opportunities across all assets (USDC, ETH, WBTC, etc). Do NOT call this multiple times for different assets — one call returns everything.",
      parameters: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            description: "Filter by blockchain (default: base)",
          },
          asset: {
            type: "string",
            description: "Filter by asset symbol (USDC, ETH, WETH, WBTC, stETH, etc.)",
          },
          protocol: {
            type: "string",
            description: "Filter by protocol: aave, compound, uniswap, curve, lido, yearn, euler, morpho",
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
            description: "Sort: apy (highest first), tvl (largest first), risk (lowest first)",
          },
          limit: {
            type: "number",
            description: "Maximum results (default: 20, max: 50)",
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
        "Returns user's DeFi positions across protocols (Aave V3, Compound V3, LI.FI, Lido) with values, APYs, and position IDs. Each position has format: {protocol, asset, deposited, current_value, entry_apy, position_id, chain}.",
      parameters: {
        type: "object",
        properties: {
          wallet_address: {
            type: "string",
            description: "User's wallet address",
          },
          chain: {
            type: "string",
            description: "Filter by chain (default: queries all chains)",
          },
          protocols: {
            type: "array",
            items: { type: "string" },
            description: "Filter by protocols: ['aave', 'compound', 'lido', 'uniswap', etc.]",
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
        "Returns deposit or withdrawal quote with expected amounts, slippage, price impact, gas cost, and execution details.",
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
            description: "Amount in human format (e.g., '1000')",
          },
          asset: {
            type: "string",
            description: "Token symbol or address",
          },
          pool_address: {
            type: "string",
            description: "Target pool contract address or LI.FI opportunity ID",
          },
          chain: {
            type: "string",
            description: "Blockchain network (default: base)",
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
        "Returns risk score (0-100) with 6-dimension breakdown for given positions. Dimensions: smart_contract, impermanent_loss, liquidation, concentration, market, chain_diversity. Accepts positions in format: [{protocol, asset, amount, chain}].",
      parameters: {
        type: "object",
        properties: {
          positions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                protocol: { type: "string", description: "Protocol name (e.g., 'Aave V3', 'Compound V3')" },
                asset: { type: "string", description: "Asset symbol (e.g., 'USDC', 'ETH')" },
                amount: { type: "string", description: "Amount deposited (e.g., '1000')" },
                chain: { type: "string", description: "Chain name (e.g., 'base')" },
              },
              required: ["protocol", "asset"],
            },
            description: "Positions to analyze",
          },
          time_horizon: {
            type: "string",
            enum: ["short", "medium", "long"],
            description: "Investment horizon",
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
        "Returns current USD price and 24h change for a token.",
      parameters: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "Token symbol (ETH, USDC, WBTC, stETH, etc.) or address",
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
        "Returns protocol details: security audits, TVL, supported chains, hack history, risk score, and description.",
      parameters: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description: "Protocol name: aave, compound, uniswap, curve, lido, gmx, yearn, euler, morpho",
          },
          include_audits: {
            type: "boolean",
            description: "Include detailed security audit information",
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
        "Returns current gas price in gwei and estimated USD cost for a specific action type.",
      parameters: {
        type: "object",
        properties: {
          chain: {
            type: "string",
            description: "Blockchain network (default: base)",
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
        "Builds deposit transaction data for wallet signing. Returns: transaction preview, estimated APY, gas costs, approval requirements. For Aave/Compound: pass protocol name only. For LI.FI vaults: pass opportunity_id. For other vaults: pass pool_address. After success, UI shows inline confirm button automatically.",
      parameters: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description: "Target protocol: aave, aave-v3, compound, compound-v3, euler, morpho, yearn, or vault name",
          },
          asset: {
            type: "string",
            description: "Asset to deposit: USDC, USDT, ETH, WETH, WBTC, stETH",
          },
          amount: {
            type: "string",
            description: "Amount in human format (e.g., '1000')",
          },
          chain: {
            type: "string",
            description: "Blockchain network (default: base)",
          },
          wallet_address: {
            type: "string",
            description: "User's wallet address (0x...)",
          },
          opportunity_id: {
            type: "string",
            description: "LI.FI opportunity ID from discover_opportunities for Base Earn vaults",
          },
          pool_address: {
            type: "string",
            description: "Vault contract address (0x...) for non-aave/compound protocols",
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
        "Builds withdrawal transaction data for wallet signing. Returns: withdrawal preview, gas costs, and current position value. After success, UI shows inline confirm button automatically.",
      parameters: {
        type: "object",
        properties: {
          position_id: {
            type: "string",
            description: "Position identifier. Formats: 'protocol-chain-asset' (e.g., 'aave-v3-base-usdc') for Aave/Compound, or 'chainId:protocol:asset' (e.g., '8453:morpho-v1:USDC') for LI.FI/Morpho positions.",
          },
          amount: {
            type: "string",
            description: "Amount to withdraw in human format. Use 'max' for full withdrawal.",
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
      name: "build_transaction_deposit",
      description:
        "Final step for deposits. Passes prepared transaction data to the UI for wallet signing. Only call after prepare_deposit succeeds and user has confirmed. user_confirmation MUST be true.",
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
            description: "MUST be true. User has seen preview and confirmed.",
          },
          opportunity_id: {
            type: "string",
            description: "LI.FI opportunity ID if applicable",
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
      name: "build_transaction_withdraw",
      description:
        "Final step for withdrawals. Passes prepared transaction data to the UI for wallet signing. Only call after prepare_withdraw succeeds and user has confirmed. user_confirmation MUST be true.",
      parameters: {
        type: "object",
        properties: {
          position_id: {
            type: "string",
            description: "Position identifier to withdraw from. Supports all protocols: Aave, Compound, Morpho, YO Protocol, and any LI.FI-integrated vault.",
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
            description: "MUST be true. User has seen preview and confirmed.",
          },
        },
        required: ["position_id", "amount", "wallet_address", "user_confirmation"],
      },
    },
  },
] as const;
