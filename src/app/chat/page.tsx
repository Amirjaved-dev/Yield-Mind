"use client";

import { useState } from "react";
import { ChevronDown, Crown, User } from "lucide-react";
import { ArrowRight, Bot, Check, Paperclip } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Anthropic from "@/components/icons/anthropic";
import AnthropicDark from "@/components/icons/anthropic-dark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

const OPENAI_SVG = (
  <div className="h-[1em] w-[1em] flex-shrink-0">
    <svg
      aria-label="o3-mini icon"
      className="block h-full w-full dark:hidden"
      preserveAspectRatio="xMidYMid"
      viewBox="0 0 256 260"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>OpenAI Icon Light</title>
      <path d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z" />
    </svg>
    <svg
      aria-label="o3-mini icon"
      className="hidden h-full w-full dark:block"
      preserveAspectRatio="xMidYMid"
      viewBox="0 0 256 260"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>OpenAI Icon Dark</title>
      <path
        d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z"
        fill="#fff"
      />
    </svg>
  </div>
);

function AIPromptInput() {
  const [value, setValue] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 56,
    maxHeight: 300,
  });
  const [selectedModel, setSelectedModel] = useState("Claude 4.5 Sonnet");

  const AI_MODELS = [
    "Gemini 3",
    "GPT-5-mini",
    "Claude 4.5 Sonnet",
    "GPT-5-1 Mini",
    "GPT-5-1",
  ];

  const MODEL_ICONS: Record<string, React.ReactNode> = {
    "GPT-5-mini": OPENAI_SVG,
    "Gemini 3": (
      <svg
        height="1em"
        style={{ flex: "none", lineHeight: "1" }}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Gemini</title>
        <defs>
          <linearGradient
            id="lobe-icons-gemini-fill"
            x1="0%"
            x2="68.73%"
            y1="100%"
            y2="30.395%"
          >
            <stop offset="0%" stopColor="#1C7DFF" />
            <stop offset="52.021%" stopColor="#1C69FF" />
            <stop offset="100%" stopColor="#F0DCD6" />
          </linearGradient>
        </defs>
        <path
          d="M12 24A14.304 14.304 0 000 12 14.304 14.304 0 0012 0a14.305 14.305 0 0012 12 14.305 14.305 0 00-12 12"
          fill="url(#lobe-icons-gemini-fill)"
          fillRule="nonzero"
        />
      </svg>
    ),
    "Claude 4.5 Sonnet": (
      <div>
        <svg
          className="block dark:hidden"
          fill="#000"
          fillRule="evenodd"
          style={{ flex: "none", lineHeight: "1" }}
          viewBox="0 0 24 24"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Anthropic Icon Light</title>
          <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
        </svg>
        <svg
          className="hidden dark:block"
          fill="#fff"
          fillRule="evenodd"
          style={{ flex: "none", lineHeight: "1" }}
          viewBox="0 0 24 24"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Anthropic Icon Dark</title>
          <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
        </svg>
      </div>
    ),
    "GPT-5-1 Mini": OPENAI_SVG,
    "GPT-5-1": OPENAI_SVG,
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setValue("");
      adjustHeight(true);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-2xl bg-[#2f2f2f] p-1.5 pt-3">
        <div className="mx-2 mb-2 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2">
            <Anthropic className="h-3 w-3 text-[#ececec]/70" />
            <span className="text-[#ececec]/50 text-xs tracking-tight">
              is free this weekend!
            </span>
          </div>
          <span className="text-[#ececec]/50 text-xs tracking-tight">
            Ship Now!
          </span>
        </div>
        <div className="relative">
          <div className="relative flex flex-col">
            <Textarea
              className={cn(
                "w-full resize-none rounded-xl rounded-b-none border-none bg-transparent px-4 py-3 placeholder:text-[#ececec]/30 focus-visible:ring-0 focus-visible:ring-offset-0 text-[#ececec]",
                "min-h-[56px]"
              )}
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder={"Ask anything"}
              ref={textareaRef}
              value={value}
            />

            <div className="flex h-12 items-center rounded-b-xl">
              <div className="absolute right-3 bottom-2.5 left-3 flex w-[calc(100%-24px)] items-center justify-between">
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="flex h-7 items-center gap-1 rounded-md pr-2 pl-1 text-xs text-[#ececec]/70 hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0 hover:text-[#ececec]"
                        variant="ghost"
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-1"
                            exit={{ opacity: 0, y: 5 }}
                            initial={{ opacity: 0, y: -5 }}
                            key={selectedModel}
                            transition={{ duration: 0.15 }}
                          >
                            {MODEL_ICONS[selectedModel]}
                            <span className="max-w-[120px] truncate">{selectedModel}</span>
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </motion.div>
                        </AnimatePresence>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className={cn(
                        "min-w-[10rem] border-white/10",
                        "bg-gradient-to-b from-[#2f2f2f] via-[#2a2a2a] to-[#222]"
                      )}
                    >
                      {AI_MODELS.map((model) => (
                        <DropdownMenuItem
                          className="flex items-center justify-between gap-2 text-[#ececec]"
                          key={model}
                          onSelect={() => setSelectedModel(model)}
                        >
                          <div className="flex items-center gap-2">
                            {MODEL_ICONS[model] || (
                              <Bot className="h-4 w-4 opacity-50" />
                            )}
                            <span>{model}</span>
                          </div>
                          {selectedModel === model && (
                            <Check className="h-4 w-4 text-blue-400" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="mx-0.5 h-4 w-px bg-white/10" />
                  <label
                    aria-label="Attach file"
                    className={cn(
                      "cursor-pointer rounded-lg p-1.5",
                      "hover:bg-white/10 text-[#ececec]/40 hover:text-[#ececec]/70 transition-colors"
                    )}
                  >
                    <input className="hidden" type="file" />
                    <Paperclip className="h-4 w-4" />
                  </label>
                </div>
                <button
                  aria-label="Send message"
                  className={cn(
                    "rounded-lg p-1.5",
                    "hover:bg-white/10 transition-colors"
                  )}
                  disabled={!value.trim()}
                  type="button"
                >
                  <ArrowRight
                    className={cn(
                      "h-4 w-4 transition-opacity duration-200",
                      value.trim() ? "text-[#ececec] opacity-100" : "text-[#ececec]/30"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-[#ececec]/20 mt-3">
        ChatGPT can make mistakes. Consider checking important information.
      </p>
    </div>
  );
}

export default function ChatPage() {
  return (
    <div className="flex h-[100dvh] flex-col bg-[#171717] text-[#ececec]">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-[#2a2a2a] px-3 py-1.5 rounded-lg transition-colors">
          <span className="font-semibold text-sm">ChatGPT</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#ececec]/60"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#2a2a2a] hover:bg-[#333] rounded-full transition-colors border border-white/10">
            <Crown size={14} className="text-purple-400" />
            <span>Get Plus</span>
          </button>
          <button className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors">
            <User size={18} />
          </button>
          <button className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-end justify-center px-4 pb-6">
        <AIPromptInput />
      </div>
    </div>
  );
}
