# YieldMind

**AI-Powered DeFi Yield Optimization Agent**

YieldMind is an intelligent DeFi assistant that lets users describe their yield goals in plain English and automatically scans protocols, analyzes risk, discovers opportunities, and executes deposits/withdrawals across multiple chains — all through a conversational chat interface.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Supported Chains & Protocols](#supported-chains--protocols)
- [AI Agent System](#ai-agent-system)
- [API Routes](#api-routes)
- [Contributing](#contributing)

---

## Features

### AI Chat Interface
- **Natural language DeFi interactions** — Type goals like "Find best stablecoin yields" or "Deposit 500 USDC into Aave"
- **Real-time streaming responses** — Server-Sent Events (SSE) for token-by-token output
- **Multi-model support** — Switch between GLM-5.1 (flagship), GLM-5-Turbo, GLM-4.7, GLM-4.5-AirX, and free tiers
- **Chat history persistence** — Conversations saved to localStorage with sidebar navigation
- **Slash commands** — Quick actions via `/` command menu
- **Agent progress panel** — Visual step-by-step execution tracking with timing data

### Portfolio Management
- **Portfolio summary** — Complete wallet snapshot: token balances (USD values), DeFi positions, total value
- **Position tracking** across Aave V3, Compound V3, Lido, Morpho, YO Protocol, and LI.FI Earn vaults
- **Balance checking** for any token on any supported chain
- **Token price lookups** via DeFi Llama / CoinGecko

### Yield Discovery
- **Opportunity scanning** via DeFi Llama yields API (all chains) and LI.FI Earn (Base)
- **Smart filtering** by APY, risk level, protocol, asset, TVL
- **Safety scoring** — Scam detection, TVL thresholds, audit-aware protocol ranking
- **Risk analysis** — 6-dimension portfolio risk scoring (smart contract, impermanent loss, liquidation, concentration, market, chain diversity)

### Transaction Execution
- **One-click deposits** into Aave V3, Compound V3, Morpho, YO Protocol, and any LI.FI-integrated vault
- **Withdrawals** from all supported protocols with full/partial options
- **Auto approval flow** — ERC20 `approve()` → deposit in a single confirmed action
- **LI.FI Composer integration** — Cross-chain deposit routing with status polling
- **Gas estimation** in USD for all actions
- **Transaction modal** with real-time status tracking

### Wallet & Chain Support
- **Multi-chain** — Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, BSC
- **WalletConnect** via RainbowKit — MetaMask, Coinbase Wallet, WalletConnect, and 350+ wallets
- **Chain selector** component with preferred chain persistence

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                     │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ Landing  │  │ Chat Page    │  │ Components           │   │
│  │ Page     │  │ (SSE Stream) │  │ - VaultList          │   │
│  └──────────┘  └──────┬───────┘  │ - TransactionModal   │   │
│                       │          │ - ActionCard          │   │
│                       ▼          │ - AgentProgressPanel  │   │
│              ┌────────────────┐  │ - Sidebar             │   │
│              │  API Route     │  └─────────────────────┘   │
│              │  /api/agent    │                            │
│              └───────┬────────┘                            │
│                      │                                      │
│  ┌───────────────────┼───────────────────────────────────┐  │
│  │                   │              Agent Layer          │  │
│  │  ┌────────────┐  ┌▼───────────┐  ┌────────────────┐  │  │
│  │  │ Reasoner   │  │ Planner     │  │ State Manager  │  │  │
│  │  │ (Intent)   │  │ (Flows)     │  │ (Per-wallet)   │  │  │
│  │  └────────────┘  └────────────┘  └────────────────┘  │  │
│  └───────────────────┼───────────────────────────────────┘  │
│                      │                                      │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │                    Data Layer                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │  │
│  │  │ DeFi Llama │  │ LI.FI Earn │  │ RPC (on-chain) │  │  │
│  │  │ Yields     │  │ Vaults     │  │ Balances       │  │  │
│  │  │ Prices     │  │ Quotes     │  │ Positions      │  │  │
│  │  │ Protocols  │  │ Positions  │  │ TX Execution   │  │  │
│  │  └────────────┘  └────────────┘  └────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                      │                                      │
│               ┌──────▼──────┐                               │
│               │  z.ai LLM   │  (GLM-4.5-airx / GLM-5.1)   │
│               │  (Tool Use) │                               │
│               └─────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 (strict mode) |
| **UI** | React 19, Tailwind CSS 4, Radix UI |
| **Blockchain** | Wagmi v2, Viem, RainbowKit |
| **AI/LLM** | z.ai (GLM models: 4.5-airx, 4.6, 4.7, 5-turbo, 5.1) |
| **DeFi Data** | DeFi Llama API, LI.FI Earn / Composer |
| **State** | React hooks, localStorage, in-memory session state |
| **Styling** | Tailwind CSS 4, custom dark theme (#061514 base) |
| **Icons** | Lucide React |
| **Notifications** | react-hot-toast |
| **Markdown** | react-markdown + remark-gfm |
| **Animation** | Motion (Framer Motion) |

---

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- A wallet (MetaMask, Coinbase Wallet, etc.)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd YieldMind

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your API keys
```

### Configure Environment

Edit `.env.local` with at minimum:

```env
ZAI_API_KEY=your_zai_api_key_here
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id_here
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZAI_API_KEY` | Yes | z.ai API key for the LLM agent. Get one at [z.ai](https://z.ai) |
| `NEXT_PUBLIC_WC_PROJECT_ID` | Yes | WalletConnect Project ID for wallet connection. Get one at [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| `LIFI_INTEGRATOR_ID` | No | LI.FI Integrator ID for cross-chain vault access and quotes. Get one at [li.fi](https://li.fi) |
| `NEXT_PUBLIC_APP_URL` | No | Public URL of the app (used for LI.FI proxy callbacks) |
| `ETH_RPC_URL` | No | Custom Ethereum mainnet RPC endpoint |
| `ARBITRUM_RPC_URL` | No | Custom Arbitrum RPC endpoint |
| `BASE_RPC_URL` | No | Custom Base RPC endpoint |

---

## Project Structure

```
YieldMind/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (fonts, providers)
│   │   ├── page.tsx                   # Landing page with hero + prompt input
│   │   ├── globals.css                # Global styles + Tailwind
│   │   ├── providers.tsx              # Wagmi + RainbowKit + QueryClient setup
│   │   ├── ClientProviders.tsx        # Client-side provider wrapper
│   │   ├── chat/
│   │   │   └── page.tsx               # Main chat interface (SSE, sidebar, messages)
│   │   └── api/
│   │       ├── agent/
│   │       │   ├── route.ts           # Core agent API (LLM orchestration, tool execution, SSE)
│   │       │   └── feedback/
│   │       │       └── route.ts       # Agent feedback endpoint
│   │       ├── vaults/
│   │       │   └── route.ts           # Vault listing API
│   │       └── lifi-proxy/
│   │           └── route.ts           # LI.FI API proxy (CORS-safe)
│   ├── components/
│   │   ├── ui/                        # Base UI components (button, textarea, dropdown, etc.)
│   │   ├── icons/                     # Brand icons (Anthropic logo variants)
│   │   ├── ActionCard.tsx             # Deposit/withdraw confirmation card
│   │   ├── ApproveButton.tsx          # Token approval button
│   │   ├── ChainPrompt.tsx            # Chain selection prompt on connect
│   │   ├── ChainSelector.tsx          # Network switcher dropdown
│   │   ├── ConnectButton.tsx          # Styled wallet connect button
│   │   ├── DepositButton.tsx          # Deposit action button
│   │   ├── ErrorBoundary.tsx          # React error boundary wrapper
│   │   ├── ErrorModal.tsx             # Error display modal
│   │   ├── TransactionModal.tsx       # TX status/confirmation modal
│   │   ├── VaultCard.tsx              # Single vault opportunity card
│   │   └── VaultList.tsx              # LI.FI vault browser list
│   ├── lib/
│   │   ├── agent-tools.ts             # 15 tool definitions (OpenAI function-calling schema)
│   │   ├── agent-reasoner.ts          # Intent reasoning engine (LLM-powered + regex fallback)
│   │   ├── agent-planner.ts           # Execution plan builder (intent → tool flow graphs)
│   │   ├── agent-state.ts             # Per-wallet conversation state machine
│   │   ├── adaptive-planner.ts        # Adaptive/replanning logic
│   │   ├── cache.ts                   # In-memory TTL cache with typed entries
│   │   ├── defi-data.ts               # Core DeFi data layer (yields, positions, quotes, risk, prices)
│   │   ├── errors.ts                  # Error classification & user-friendly messages
│   │   ├── lifi-earn.ts               # LI.FI Earn SDK integration (vaults, quotes, positions, status)
│   │   ├── models.ts                  # Available AI model configurations + tier labels
│   │   ├── prompts/
│   │   │   └── system-prompt.ts       # Dynamic system prompt builder for the agent
│   │   ├── slash-commands.tsx         # Slash command registry + UI component
│   │   ├── toast.tsx                  # Toast notification helpers
│   │   ├── utils.ts                   # Utility functions (cn() class merger)
│   │   └── wagmi.ts                   # Wagmi configuration
│   └── hooks/
│       ├── use-auto-resize-textarea.ts # Auto-growing textarea hook
│       ├── use-chat-storage.ts         # localStorage chat persistence
│       ├── use-preferred-chain.ts      # User chain preference hook
│       ├── use-slash-commands.ts       # Slash command parsing & state
│       └── useTransactionFlow.ts       # Full TX lifecycle hook (approve → deposit/withdraw → confirm)
├── public/                             # Static assets (logo, SVGs)
├── skills/                             # Agent skill definitions
├── .env.example                        # Environment variable template
├── next.config.ts                      # Next.js config (Turbopack, webpack fallbacks)
├── tsconfig.json                       # TypeScript config (@/* path alias)
├── postcss.config.mjs                  # PostCSS + Tailwind config
├── eslint.config.mjs                   # ESLint configuration
└── package.json                        # Dependencies & scripts
```

---

## How It Works

### 1. User Sends a Message

The user types a natural language request like *"Find best USDC yields on Base"* or *"Deposit 1000 USDC into Aave"*.

### 2. Intent Analysis

The message flows through:
- **Agent Reasoner** (`agent-reasoner.ts`) — Uses LLM to classify intent (deposit/withdraw/discover/portfolio/risk/etc.), extract parameters (protocol, asset, amount), assess complexity, and flag ambiguities. Falls back to regex if LLM unavailable.
- **Agent Planner** (`agent-planner.ts`) — Maps intent to a deterministic execution plan (tool call graph). For example, a deposit intent becomes: `[check_balance + discover_opportunities] → prepare_deposit`.

### 3. Agent Orchestration (`/api/agent`)

The API route:
1. Builds the system prompt with wallet address, chain, and conversation state
2. Sends messages to z.ai's chat completions API with tool definitions
3. Streams responses back via **Server-Sent Events (SSE)**:
   - `thinking` — Agent is processing
   - `step` — Individual tool execution step (label, icon, status, duration)
   - `tool_call` — Tool being invoked
   - `tool_result` — Tool completed with summary
   - `token` — Streaming text output
   - `transaction_ready` — TX prepared, awaiting user confirmation
   - `done` / `error` — Final status

4. Supports up to **3 tool rounds** with automatic retry on failures (rate limits, timeouts)

### 4. Tool Execution

The agent has **15 tools** available:

| Tool | Purpose |
|------|---------|
| `get_portfolio_summary` | Full wallet snapshot (balances + positions + value) |
| `get_market_overview` | ETH price, gas costs, top opportunities |
| `check_balance` | Token balance + USD value for specific asset |
| `check_approval` | ERC20 allowance check |
| `discover_opportunities` | Scan DeFi Llama / LI.FI for yield opportunities |
| `get_positions` | Fetch user's DeFi positions across protocols |
| `get_quote` | Deposit/withdraw quote with slippage & gas |
| `analyze_risk` | 6-dimension portfolio risk scoring |
| `get_token_price` | Current USD price + 24h change |
| `get_protocol_info` | Protocol details, audits, TVL, hack history |
| `get_gas_estimate` | Gas price in gwei + estimated USD cost |
| `prepare_deposit` | Build deposit TX data (shows confirmation card) |
| `prepare_withdraw` | Build withdrawal TX data |
| `build_transaction_deposit` | Final deposit step after user confirms |
| `build_transaction_withdraw` | Final withdraw step after user confirms |

### 5. Transaction Flow

When a user confirms a deposit/withdrawal:

```
User Confirm → executeDeposit()/executeWithdraw()
    ├─ 1. Switch to correct chain (if needed)
    ├─ 2. ERC20 approve() (if required, not native token)
    ├─ 3. Deposit/Withdraw transaction
    │    ├─ Aave: supply() / withdraw()
    │    ├─ Compound: supply() / withdraw()
    │    ├─ Morpho: withdraw() / redeem()
    │    ├─ LI.FI: Composer transaction (cross-chain)
    │    └─ Generic: Raw tx.data execution
    ├─ 4. Wait for on-chain receipt
    ├─ 5. Poll LI.FI Composer status (if cross-chain)
    └─ 6. Show success/error state
```

---

## Supported Chains & Protocols

### Chains (7)

| Chain | Chain ID | Default RPC |
|-------|----------|-------------|
| Ethereum | 1 | eth.llamarpc.com |
| Arbitrum | 42161 | arb1.arbitrum.io |
| Optimism | 10 | mainnet.optimism.io |
| Base | 8453 | mainnet.base.org |
| Polygon | 137 | polygon-rpc.com |
| Avalanche | 43114 | api.avax.network |
| BSC | 56 | bsc-dataseed.binance.org |

### Protocols

**Direct Integration (on-chain):**
- **Aave V3** — Supply/withdraw via pool contract (Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche)
- **Compound V3 (Comet)** — Supply/withdraw via comet contract (Ethereum, Arbitrum, Base)
- **Morpho** — Withdraw via market contract (Base)
- **YO Protocol** — ERC4626 vault interaction (Base)
- **Lido** — stETH balance reading (Ethereum)

**Via LI.FI Earn (Base chain):**
- All LI.FI-integrated vaults and yield opportunities on Base
- Cross-chain deposit routing via LI.FI Composer

**Data Sources:**
- **DeFi Llama** — Yields, prices, protocol info, audits, hack history (all chains)
- **The Graph** — Aave V3 subgraphs for position data (fallback to RPC)

---

## AI Agent System

### Model Selection

Users can choose from 8 GLM models organized into 4 tiers:

| Tier | Models | Best For |
|------|--------|----------|
| **Flagship** | GLM-5.1 | Complex reasoning, coding tasks |
| **Smart** | GLM-5-Turbo, GLM-4.7, GLM-4.6 | Long agent tasks, strong tool calling |
| **Fast** | GLM-4.5-AirX (default), GLM-4-FlashX | Low latency, balanced quality |
| **Free** | GLM-4.7-Flash, GLM-4-Flash | Cost-free usage |

Default model: **GLM-4.5-AirX** (balanced speed/quality)

### System Prompt Strategy

The system prompt is dynamically built per-request with:
- User's wallet address
- Active chain
- Conversation state (phase, last discovery, last transaction, turn count)
- Strict output rules: max 8 lines, real numbers only, no filler, data-first responses

### Tool-Use Loop

```
User Message → [Reasoner] → [Planner] → LLM Call (with tools)
                                              ↓
                                         Tool calls?
                                        ↙         ↚
                                    Yes              No
                                     ↓                ↓
                              Execute tools    Stream final
                              (parallel OK)     response
                                     ↓
                              Return results to LLM
                                     ↓
                              More tool calls? (max 3 rounds)
                                     ↓
                              Stream final response
```

### Caching Strategy

In-memory TTL cache reduces API calls:

| Data | TTL |
|------|-----|
| ETH Price | 60s |
| Token Prices | 60s |
| Opportunities | 60s |
| Balances | 15s |
| Positions | 30s |
| Quotes | 15s |
| Gas Estimates | 30s |
| Protocol Info | 5min |
| Market Overview | 2min |

---

## API Routes

### `POST /api/agent`

Main agent endpoint. Accepts JSON body:

```json
{
  "goal": "Find best USDC yields",
  "wallet_address": "0x...",
  "model": "glm-4.5-airx",
  "chat_history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Returns **Server-Sent Events (SSE)** stream with event types: `thinking`, `step`, `tool_call`, `tool_result`, `token`, `clear`, `action_required`, `transaction_ready`, `done`, `error`.

### `GET/POST /api/lifi-proxy`

Proxy for LI.FI API calls (avoids CORS issues). Forwards requests to LI.FI endpoints:
- `GET /api/lifi-proxy?path=earn/vaults&chainId=8453&asset=USDC`
- `POST /api/lifi-proxy?path=quote` (with LI.FI quote body)
- `GET /api/lifi-proxy?path=status&txHash=...`

### `GET /api/vaults`

Returns available LI.FI Earn vaults for browsing.

### `POST /api/agent/feedback`

Submit feedback on agent responses.

---

## Design System

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#061514` | Primary background |
| Surface | `#091615` | Cards, inputs |
| Surface Elevated | `#0d1e1d` | Hover states, buttons |
| Accent Primary | `#88fff7` | Cyan accent (agent brand) |
| Accent Secondary | `#f59e0b` | Amber (CTAs, warnings) |
| Text Primary | `#FFFFFF` | Headings, important text |
| Text Secondary | `gray-200/90` | Body text |
| Text Muted | `gray-400/50` | Labels, placeholders |
| Success | `emerald-400` | Connected states, confirmations |
| Error | `red-400` | Error states |

### Typography

- **Font**: Geist Sans (body), Geist Mono (code/addresses)
- **Headings**: Bold, tight tracking
- **Body**: 15px base, relaxed line-height (1.75)

---

## Scripts

```bash
npm run dev      # Start development server (Turbopack)
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

---

## License

MIT
