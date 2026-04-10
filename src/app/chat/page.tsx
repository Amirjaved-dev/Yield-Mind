"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import {
  Wallet,
  Square,
  Sparkles,
  Search,
  Shield,
  Calculator,
  ChevronRight,
  Check,
  Loader2,
  CircleDot,
  Zap,
  SendHorizonal,
  PanelLeftClose,
  PanelLeft,
  Plus,
  MessageSquare,
  Trash2,
  Activity,
  Clock,
  TrendingUp,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import {
  useChatStorage,
  type StoredChat,
  type StoredChatMessage,
} from "@/hooks/use-chat-storage";

type MessageStatus = "thinking" | "streaming" | "done" | "error";

type AgentStep = {
  id: number;
  label: string;
  icon: string;
  status: "active" | "done" | "error";
  summary?: string;
  durationMs?: number;
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  status?: MessageStatus;
  agentSteps?: AgentStep[];
};

const QUICK_ACTIONS = [
  { text: "Find best yields", icon: Search, prompt: "Find best stablecoin yields on Ethereum" },
  { text: "My positions", icon: Wallet, prompt: "Check my current DeFi positions" },
  { text: "Risk analysis", icon: Shield, prompt: "Analyze my portfolio risk" },
  { text: "Compare APYs", icon: TrendingUp, prompt: "Compare lending protocol APYs" },
];

const ICON_MAP: Record<string, React.ElementType> = {
  brain: CircleDot,
  "magnifying-glass": Search,
  wallet: Wallet,
  calculator: Calculator,
  shield: Shield,
  wrench: Zap,
  sparkles: Sparkles,
};

function StepIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] || CircleDot;
  return <Icon size={size} />;
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-[#88fff7]/60 animate-pulse" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#88fff7]/60 animate-pulse [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#88fff7]/60 animate-pulse [animation-delay:300ms]" />
    </span>
  );
}

function BlinkingCursor() {
  return (
    <span className="inline-block h-4 w-[3px] translate-y-0.5 rounded-sm bg-[#88fff7]/70 ml-0.5 align-middle [animation:blink_1s_step-end_infinite]" />
  );
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="max-w-none text-[15px] leading-7 text-gray-200/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 mb-3 text-xl font-semibold text-white first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 mb-3 text-lg font-semibold text-white first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 text-base font-semibold text-white first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          hr: () => <hr className="my-5 border-white/10" />,
          code: ({ children, className }) => (
            <code className={cn("rounded bg-white/8 px-1.5 py-0.5 text-[0.92em] text-gray-100", className)}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto rounded-xl border border-[#88fff7]/10 bg-[#0a1514] p-4 text-sm text-gray-100">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto rounded-xl border border-white/8">
              <table className="min-w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/6">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-white/10 px-3 py-2 font-medium text-white">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-t border-white/6 px-3 py-2 align-top text-gray-300">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function formatWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ChatWalletButton({ compact = false }: { compact?: boolean }) {
  return (
    <RainbowConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        authenticationStatus,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        if (!ready) {
          return <div aria-hidden="true" className={cn("rounded-full border border-white/10 bg-[#0d1e1d]/60 opacity-0", compact ? "h-8 w-24" : "h-10 w-[148px]")} />;
        }

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={cn(
                "flex items-center gap-2 rounded-full border border-[#88fff7]/15 bg-[#0d1e1d]/80 backdrop-blur-sm transition-all hover:bg-[#0d1e1d] hover:text-white hover:border-[#88fff7]/30 text-white/80",
                compact ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
              )}
            >
              <Wallet size={compact ? 12 : 15} />
              <span>{compact ? "Connect" : "Connect wallet"}</span>
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="flex h-10 items-center gap-2 rounded-full border border-[#f59e0b]/20 bg-[#f59e0b]/10 px-4 text-sm text-amber-100 transition-colors hover:bg-[#f59e0b]/15"
            >
              Wrong network
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={openAccountModal}
            title={account.displayName}
            className={cn(
              "flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-500/10 backdrop-blur-sm transition-all hover:bg-emerald-500/15 text-emerald-50",
              compact ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
            )}
          >
            <span className={cn("rounded-full bg-emerald-400 animate-pulse", compact ? "h-1.5 w-1.5" : "h-2 w-2")} />
            <span>{formatWalletAddress(account.address)}</span>
          </button>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}

function AgentProgressPanel({ steps }: { steps: AgentStep[] }) {
  if (steps.length === 0) return null;
  const activeStep = steps.find((s) => s.status === "active");
  const allDone = steps.every((s) => s.status === "done");

  return (
    <div className="mr-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-[#88fff7]/8 bg-[#091615]/80 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="relative flex items-center justify-center">
            {activeStep && (
              <div className="absolute inset-0 rounded-full bg-[#88fff7]/20 animate-ping" style={{ animationDuration: "2s" }} />
            )}
            <div
              className={cn(
                "relative flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                allDone ? "bg-emerald-500/20 text-emerald-400" : "bg-[#88fff7]/15 text-[#88fff7]",
              )}
            >
              {allDone ? <Check size={13} strokeWidth={2.5} /> : <Zap size={13} />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-white/70 uppercase">Agent</span>
            {activeStep ? (
              <span className="flex items-center gap-1.5 text-xs text-[#88fff7]/60">
                <Loader2 size={11} className="animate-spin" />
                {activeStep.label}...
              </span>
            ) : allDone ? (
              <span className="text-xs text-emerald-400/60">Complete</span>
            ) : null}
          </div>
        </div>
        <div className="px-4 py-2.5 space-y-0.5">
          {steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 px-2 py-2 rounded-lg transition-all",
                step.status === "active" && "bg-[#88fff7]/[0.04]",
                step.status === "done" && "opacity-70",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0 shrink-0">
                <div
                  className={cn(
                    "flex items-center justify-center h-5 w-5 rounded-md text-[10px] font-bold shrink-0 transition-colors",
                    step.status === "active" && "bg-[#88fff7]/15 text-[#88fff7]",
                    step.status === "done" && "bg-emerald-500/15 text-emerald-400",
                    step.status === "error" && "bg-red-500/15 text-red-400",
                  )}
                >
                  {step.status === "done" ? (
                    <Check size={11} strokeWidth={2.5} />
                  ) : step.status === "error" ? (
                    <span className="text-[10px]">!</span>
                  ) : (
                    <StepIcon name={step.icon} size={11} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-medium truncate transition-colors",
                        step.status === "active"
                          ? "text-white/90"
                          : step.status === "done"
                            ? "text-white/50"
                            : "text-white/30",
                      )}
                    >
                      {step.label}
                    </span>
                    {step.status === "active" && (
                      <span className="shrink-0">
                        <Loader2 size={10} className="text-[#88fff7]/60 animate-spin" />
                      </span>
                    )}
                  </div>
                  {step.status === "done" && step.summary && (
                    <span className="text-[11px] text-white/30 truncate block">
                      {step.summary}
                      {step.durationMs != null && (
                        <span className="ml-2 text-white/20">{(step.durationMs / 1000).toFixed(1)}s</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              {step.status === "active" && (
                <ChevronRight size={12} className="text-[#88fff7]/30 mt-0.5 shrink-0 [animation:blink_1.5s_ease-in-out_infinite]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onRetry,
}: {
  message: ChatMessage;
  onRetry?: () => void;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isToolStatus = message.status === "streaming" && /\.\.\.$/.test(message.content.trim());
  const isTyping = message.status === "streaming" && !isToolStatus;
  const isDone = message.status === "done";

  return (
    <div
      className={cn(
        "flex w-full max-w-3xl flex-col",
        isUser && "ml-auto items-end",
        !isUser && !isSystem && "mr-auto items-start",
        isSystem && "mr-auto items-start",
      )}
    >
      {isUser && (
        <div className="mb-1.5 flex items-center gap-1.5 px-1">
          <span className="text-[11px] font-medium text-white/30">You</span>
        </div>
      )}
      <div
        className={cn(
          "max-w-2xl rounded-2xl px-5 py-4 shadow-sm transition-all",
          isUser && "bg-[#0d1e1d]/60 border border-white/6 text-gray-100",
          !isUser && !isSystem && "bg-[#091615]/60 border border-white/6 text-gray-200/90",
          isSystem && "border border-[#f59e0b]/20 bg-[#f59e0b]/8 text-amber-100",
        )}
      >
        {!isUser && !isSystem && (
          <div className="mb-2.5 flex items-center gap-2">
            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-[#88fff7]/10">
              <Sparkles size={11} className="text-[#88fff7]/70" />
            </div>
            <span className="text-[11px] font-semibold tracking-[0.15em] text-[#88fff7]/40 uppercase">YieldMind</span>
            {isDone && <span className="ml-auto text-[10px] text-white/20">done</span>}
          </div>
        )}
        {isUser || isSystem || message.status === "error" ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : message.status === "done" || isTyping ? (
          <div className="relative">
            <AssistantMarkdown content={message.content} />
            {isTyping && <BlinkingCursor />}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            {message.content && <span>{message.content}</span>}
            <ThinkingDots />
          </div>
        )}
        {message.status === "error" && onRetry && (
          <button onClick={onRetry} className="mt-3 text-xs font-medium text-[#f59e0b] transition-colors hover:text-[#f59e0b]/80">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#88fff7]/10 bg-[#88fff7]/[0.04]">
          <Sparkles size={28} className="text-[#88fff7]/50" />
        </div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#88fff7]/10 bg-[#88fff7]/5 px-4 py-1.5 text-xs font-medium text-[#88fff7]/60">
          AI-Powered DeFi Agent
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-white/90">What would you like to optimize?</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          Describe your yield goal and YieldMind will research protocols, check your positions, and build a strategy.
        </p>
        <div className="mt-8 grid gap-2.5">
          {QUICK_ACTIONS.slice(0, 3).map(({ text, icon: Icon }) => (
            <button
              key={text}
              onClick={() => onSuggestion(text)}
              className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left text-sm text-gray-400 backdrop-blur-sm transition-all hover:border-[#88fff7]/15 hover:bg-[#88fff7]/[0.04] hover:text-gray-200"
            >
              <Icon size={16} className="text-white/20 group-hover:text-[#88fff7]/60 transition-colors" />
              <span className="flex-1">{text}</span>
              <ChevronRight size={14} className="text-white/10 group-hover:text-white/30 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InputBar({
  value,
  disabled = false,
  isStreaming = false,
  onChange,
  onSubmit,
  onStop,
}: {
  value: string;
  disabled?: boolean;
  isStreaming?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 52, maxHeight: 180 });

  useEffect(() => {
    if (value) {
      adjustHeight();
      return;
    }
    adjustHeight(true);
  }, [adjustHeight, value]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isStreaming) onSubmit();
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <div
        className={cn(
          "rounded-2xl border bg-[#091615]/90 p-3 shadow-[0_24px_90px_rgba(0,0,0,0.52)] ring-1 backdrop-blur-md transition-colors",
          isStreaming
            ? "border-[#88fff7]/10 ring-[#88fff7]/5"
            : "border-white/8 ring-white/[0.04] focus-within:border-[#88fff7]/15 focus-within:ring-[#88fff7]/8",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Describe the yield strategy you want to execute..."
          disabled={disabled}
          rows={1}
          className="w-full resize-none bg-transparent text-white placeholder-gray-500 outline-none text-[15px] leading-relaxed"
        />
        <div className="mt-2 flex items-center justify-between pt-1">
          <span className="text-[11px] text-gray-600">GLM-5.1 &middot; z.ai</span>
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 rounded-lg border border-red-400/15 bg-red-500/8 px-3 py-1.5 text-xs font-medium text-red-300 transition-all hover:bg-red-500/12"
              >
                <Square size={10} fill="currentColor" />
                Stop
              </button>
            ) : (
              <button
                onClick={onSubmit}
                disabled={!value.trim()}
                className="flex items-center gap-2 rounded-lg border border-[#88fff7]/10 bg-[#88fff7]/8 px-3.5 py-1.5 text-xs font-medium text-[#88fff7]/80 transition-all hover:bg-[#88fff7]/12 hover:text-[#88fff7] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SendHorizonal size={13} />
                Run Agent
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-center text-[11px] text-gray-600">
        YieldMind can make mistakes. Consider checking important information.
      </p>
    </div>
  );
}

type SidebarProps = {
  isOpen: boolean;
  onToggle: () => void;
  chats: StoredChat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  isStreaming: boolean;
  onQuickAction: (prompt: string) => void;
};

function Sidebar({
  isOpen,
  onToggle,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  isStreaming,
  onQuickAction,
}: SidebarProps) {
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] md:hidden" onClick={onToggle} />
      )}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed left-0 top-0 z-40 flex h-full flex-col border-r border-white/6 bg-[#051312]/95 backdrop-blur-xl transition-transform duration-300 ease-out md:relative md:z-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-0",
        )}
        style={{ width: 280, minWidth: 280 }}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-[#88fff7]/10">
                <Sparkles size={14} className="text-[#88fff7]/70" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-white">YieldMind</span>
            </Link>
            <button
              onClick={onToggle}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <div className="px-3 pt-3 pb-1">
            <button
              onClick={onNewChat}
              disabled={isStreaming}
              className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-gray-300 transition-all hover:border-[#88fff7]/15 hover:bg-[#88fff7]/[0.06] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={15} className="text-white/40" />
              New chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto sidebar-scroll px-3 py-2">
            {chats.length > 0 && (
              <div className="mb-3">
                <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-white/20">Recent</span>
                <div className="mt-1.5 space-y-0.5">
                  {chats.slice(0, 20).map((chat) => (
                    <div
                      key={chat.id}
                      onMouseEnter={() => setHoveredChat(chat.id)}
                      onMouseLeave={() => setHoveredChat(null)}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer transition-all",
                        chat.id === activeChatId
                          ? "bg-white/[0.06] text-white"
                          : "text-gray-400 hover:bg-white/[0.03] hover:text-gray-200",
                      )}
                      onClick={() => onSelectChat(chat.id)}
                    >
                      <MessageSquare size={14} className="shrink-0 opacity-40" />
                      <span className="flex-1 truncate text-[13px]">{chat.title}</span>
                      {hoveredChat === chat.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteChat(chat.id);
                          }}
                          className="shrink-0 flex items-center justify-center h-6 w-6 rounded-md text-white/30 transition-colors hover:bg-red-500/15 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-white/20">Quick actions</span>
              <div className="mt-1.5 space-y-0.5">
                {QUICK_ACTIONS.map(({ text, icon: Icon, prompt }) => (
                  <button
                    key={text}
                    onClick={() => onQuickAction(prompt)}
                    disabled={isStreaming}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-gray-400 transition-all hover:bg-white/[0.03] hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Icon size={14} className="shrink-0 text-white/20 group-hover:text-[#88fff7]/50 transition-colors" />
                    <span>{text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 px-4 py-3">
            <div className="flex items-center gap-2 mb-2.5">
              <Activity size={12} className="text-white/20" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/20">Status</span>
            </div>
            {isStreaming ? (
              <div className="flex items-center gap-2.5 rounded-lg bg-[#88fff7]/[0.04] px-3 py-2">
                <Loader2 size={13} className="text-[#88fff7]/60 animate-spin" />
                <div>
                  <span className="text-xs font-medium text-white/60">Agent running</span>
                  <span className="block text-[10px] text-white/25">Processing your request...</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] px-3 py-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400/60" />
                <div>
                  <span className="text-xs font-medium text-white/50">Ready</span>
                  <span className="block text-[10px] text-white/20">{chats.length} conversations</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [value, setValue] = useState("");

  const {
    chats,
    activeChat,
    activeChatId,
    setActiveChatId,
    createChat,
    updateChat,
    deleteChat,
  } = useChatStorage();

  const nextIdRef = useRef(1);
  const consumedPromptRef = useRef<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>("");
  const contentBufferRef = useRef("");
  const flushRafRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);

  const promptFromUrl = searchParams.get("prompt")?.trim() ?? "";

  const streamPromptRef = useRef<((prompt: string) => Promise<void>) | null>(null);

  const currentChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      nextIdRef.current = 1;
      return;
    }
    const restored: ChatMessage[] = activeChat.messages.map((m) => ({
      ...m,
      status: (m.status as MessageStatus) || "done",
      agentSteps: m.agentSteps?.map((s) => ({
        ...s,
        status: s.status as AgentStep["status"],
      })),
    }));
    setMessages(restored);
    nextIdRef.current = restored.length > 0 ? Math.max(...restored.map((m) => m.id)) + 1 : 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId]);

  useEffect(() => {
    currentChatIdRef.current = activeChatId;
  }, [activeChatId]);

  streamPromptRef.current = async (prompt: string) => {
    if (isStreamingRef.current) return;

    if (!address) {
      setMessages((prev) => [
        ...prev,
        { id: nextIdRef.current++, role: "system", content: "Connect your wallet to send prompts to the YieldMind agent.", status: "error" },
      ]);
      return;
    }

    let chatId = currentChatIdRef.current;
    if (!chatId) {
      chatId = createChat();
    }

    const userMsgId = nextIdRef.current++;
    const assistantMsgId = nextIdRef.current++;

    isStreamingRef.current = true;
    setIsStreaming(true);
    setValue("");
    lastPromptRef.current = prompt;
    contentBufferRef.current = "";

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: prompt },
      { id: assistantMsgId, role: "assistant", content: "", status: "thinking", agentSteps: [] },
    ]);

    updateChat(chatId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? prompt.slice(0, 40) + (prompt.length > 40 ? "..." : "") : c.title,
      messages: [
        ...c.messages,
        { id: userMsgId, role: "user" as const, content: prompt },
        { id: assistantMsgId, role: "assistant" as const, content: "", status: "thinking" as const, agentSteps: [] },
      ],
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    function flushContent() {
      const content = contentBufferRef.current;
      if (!content) return;
      contentBufferRef.current = "";
      flushRafRef.current = null;
      setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + content } : m)));
    }

    function updateAssistant(partial: Partial<ChatMessage>) {
      setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, ...partial } : m)));
    }

    function upsertStep(stepData: {
      index: number;
      label: string;
      icon: string;
      status: "active" | "done" | "error";
      summary?: string;
      durationMs?: number;
    }) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantMsgId) return m;
          const steps = [...(m.agentSteps || [])];
          const existing = steps.findIndex((s) => s.id === stepData.index);
          const step: AgentStep = { id: stepData.index, label: stepData.label, icon: stepData.icon, status: stepData.status, summary: stepData.summary, durationMs: stepData.durationMs };
          if (existing >= 0) steps[existing] = { ...steps[existing], ...step };
          else steps.push(step);
          return { ...m, agentSteps: steps };
        }),
      );
    }

    function persistChatMessages() {
      setMessages((prev) => {
        const cleaned = prev.map((m) => ({
          ...m,
          agentSteps: m.agentSteps?.map((s) => ({ ...s })),
        }));
        if (chatId) {
          updateChat(chatId, (c) => ({ ...c, messages: cleaned as StoredChatMessage[] }));
        }
        return prev;
      });
    }

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: prompt, wallet_address: address }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("Failed to connect to YieldMind agent.");

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "";

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed.startsWith("event:")) {
            eventType = trimmed.slice(6).trim();
          } else if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            let data: Record<string, unknown> = {};

            try {
              data = JSON.parse(dataStr);
            } catch {
              // skip
            }

            switch (eventType) {
              case "thinking":
                updateAssistant({ status: "thinking" as const });
                break;
              case "step":
                upsertStep({
                  index: data.index as number,
                  label: data.label as string,
                  icon: data.icon as string,
                  status: (data.status as "active" | "done" | "error") || "active",
                  summary: data.summary as string | undefined,
                  durationMs: data.duration_ms as number | undefined,
                });
                break;
              case "tool_call":
                updateAssistant({ content: (data.label as string) || "Processing...", status: "streaming" as const });
                break;
              case "tool_result":
                setMessages((prev) => {
                  const msg = prev.find((m) => m.id === assistantMsgId);
                  const steps = msg?.agentSteps || [];
                  if (steps.length === 0) return prev;
                  const updated = steps.map((s, i) =>
                    i === steps.length - 1
                      ? { ...s, status: "done" as const, summary: data.summary as string | undefined, durationMs: data.duration_ms as number | undefined }
                      : s,
                  );
                  return prev.map((m) => (m.id === assistantMsgId ? { ...m, agentSteps: updated } : m));
                });
                break;
              case "clear":
                flushContent();
                updateAssistant({ content: "" });
                break;
              case "token": {
                contentBufferRef.current += (data.content as string) || "";
                if (!flushRafRef.current) flushRafRef.current = requestAnimationFrame(flushContent);
                break;
              }
              case "done":
                flushContent();
                updateAssistant({ status: "done" as const });
                break;
              case "error":
                flushContent();
                updateAssistant({ content: (data.message as string) || "An error occurred.", status: "error" as const });
                break;
            }
            eventType = "";
          }
        }
      }

      flushContent();
      setMessages((prev) => {
        const msg = prev.find((m) => m.id === assistantMsgId);
        if (msg && (msg.status === "thinking" || msg.status === "streaming")) {
          const updated = prev.map((m) =>
            m.id === assistantMsgId ? { ...m, status: "done" as const, content: m.content || "Agent finished but returned no content." } : m,
          );
          if (chatId) {
            updateChat(chatId, (c) => ({ ...c, messages: updated as StoredChatMessage[] }));
          }
          return updated;
        }
        if (chatId) {
          updateChat(chatId, (c) => ({ ...c, messages: prev as StoredChatMessage[] }));
        }
        return prev;
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        flushContent();
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === assistantMsgId && m.status !== "done"
              ? { ...m, content: m.content || "Generation stopped.", status: "done" as const }
              : m,
          );
          if (chatId) updateChat(chatId, (c) => ({ ...c, messages: updated as StoredChatMessage[] }));
          return updated;
        });
      } else {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: "Unable to get a response from the agent. Please try again.", status: "error" as const }
              : m,
          );
          if (chatId) updateChat(chatId, (c) => ({ ...c, messages: updated as StoredChatMessage[] }));
          return updated;
        });
      }
    } finally {
      isStreamingRef.current = false;
      setIsStreaming(false);
      abortRef.current = null;
      if (flushRafRef.current) {
        cancelAnimationFrame(flushRafRef.current);
        flushRafRef.current = null;
      }
      persistChatMessages();
    }
  };

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRetry = useCallback(() => {
    if (lastPromptRef.current) void streamPromptRef.current?.(lastPromptRef.current);
  }, []);

  const handleSuggestion = useCallback((suggestion: string) => {
    void streamPromptRef.current?.(suggestion);
  }, []);

  const handleNewChat = useCallback(() => {
    if (isStreamingRef.current) return;
    createChat();
  }, [createChat]);

  const handleSelectChat = useCallback(
    (id: string) => {
      if (isStreamingRef.current) return;
      setActiveChatId(id);
    },
    [setActiveChatId],
  );

  const handleDeleteChat = useCallback(
    (id: string) => {
      if (isStreamingRef.current) return;
      deleteChat(id);
    },
    [deleteChat],
  );

  useEffect(() => {
    if (!promptFromUrl) return;
    if (!isConnected || !address) return;
    if (consumedPromptRef.current === promptFromUrl) return;
    consumedPromptRef.current = promptFromUrl;
    setValue(promptFromUrl);
    void streamPromptRef.current?.(promptFromUrl);
    window.history.replaceState(null, "", "/chat");
  }, [address, isConnected, promptFromUrl]);

  useEffect(() => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && (m.status === "thinking" || m.status === "streaming"));
  const showProgress = lastAssistant && lastAssistant.agentSteps && lastAssistant.agentSteps.length > 0;

  return (
    <div className="flex h-[100dvh] bg-[#061514] text-gray-100 overflow-hidden">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top_center,rgba(129,255,247,0.04)_0%,transparent_70%)]" />

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        isStreaming={isStreaming}
        onQuickAction={handleSuggestion}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <header className="relative z-10 flex items-center justify-between px-4 py-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center justify-center h-8 w-8 rounded-lg text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
              >
                <PanelLeft size={16} />
              </button>
            )}
            {!sidebarOpen && (
              <Link href="/" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                <div className="flex items-center justify-center h-6 w-6 rounded-md bg-white/10">
                  <Sparkles size={13} className="text-white/70" />
                </div>
                <span className="text-sm font-semibold tracking-tight text-white hidden sm:inline">YieldMind</span>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeChat && (
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/20">
                <Clock size={11} />
                {formatRelativeTime(activeChat.updatedAt)}
              </span>
            )}
            <ChatWalletButton />
          </div>
        </header>

        <div className="relative z-10 flex flex-1 flex-col overflow-hidden px-4">
          <div ref={viewportRef} className="chat-viewport mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-y-auto px-2 pb-4 pt-4">
            {messages.length === 0 ? (
              <EmptyState onSuggestion={handleSuggestion} />
            ) : (
              <div className="flex flex-col gap-5 py-4">
                {messages.map((message) => (
                  <div key={message.id}>
                    {showProgress && message.role === "assistant" && message.agentSteps && message.agentSteps.length > 0 && (
                      <div className="mb-3">
                        <AgentProgressPanel steps={message.agentSteps} />
                      </div>
                    )}
                    <MessageBubble message={message} onRetry={message.status === "error" ? handleRetry : undefined} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center px-4 pb-6 shrink-0">
            <InputBar
              value={value}
              disabled={isStreaming}
              isStreaming={isStreaming}
              onChange={setValue}
              onSubmit={() => void streamPromptRef.current?.(value)}
              onStop={handleStop}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
