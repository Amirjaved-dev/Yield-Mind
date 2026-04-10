"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type StoredChatMessage = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  status?: string;
  agentSteps?: Array<{
    id: number;
    label: string;
    icon: string;
    status: string;
    summary?: string;
    durationMs?: number;
    input?: Record<string, unknown>;
    inputSummary?: string;
  }>;
};

export type StoredChat = {
  id: string;
  title: string;
  messages: StoredChatMessage[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "yieldmind_chats";

function loadChats(): StoredChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChats(chats: StoredChat[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch {
    // storage full or unavailable
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChatStorage() {
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    const loaded = loadChats();
    setChats(loaded);
    if (loaded.length > 0) {
      setActiveChatId(loaded[0].id);
    }
  }, []);

  const persist = useCallback((updated: StoredChat[]) => {
    setChats(updated);
    saveChats(updated);
  }, []);

  const createChat = useCallback((): string => {
    const id = generateId();
    const chat: StoredChat = {
      id,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist([chat, ...loadChats()]);
    setActiveChatId(id);
    return id;
  }, [persist]);

  const updateChat = useCallback(
    (id: string, updater: (chat: StoredChat) => StoredChat) => {
      const current = loadChats();
      const updated = current.map((c) =>
        c.id === id ? { ...updater(c), updatedAt: Date.now() } : c,
      );
      persist(updated);
    },
    [persist],
  );

  const deleteChat = useCallback(
    (id: string) => {
      const current = loadChats();
      const filtered = current.filter((c) => c.id !== id);
      persist(filtered);
      if (activeChatId === id) {
        setActiveChatId(filtered.length > 0 ? filtered[0].id : null);
      }
    },
    [persist, activeChatId],
  );

  const clearAllChats = useCallback(() => {
    persist([]);
    setActiveChatId(null);
  }, [persist]);

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  return {
    chats,
    activeChat,
    activeChatId,
    setActiveChatId,
    createChat,
    updateChat,
    deleteChat,
    clearAllChats,
  };
}
