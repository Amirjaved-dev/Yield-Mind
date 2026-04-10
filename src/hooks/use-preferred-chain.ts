"use client";

import { useState, useEffect, useCallback } from "react";

const PREFERRED_CHAIN_KEY = "yieldmind_preferred_chain";

const DEFAULT_CHAIN = 42161; // Arbitrum

export function usePreferredChain() {
  const [preferredChain, setPreferredChainState] = useState<number | null>(null);
  const [hasPrompted, setHasPrompted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(PREFERRED_CHAIN_KEY);
    if (stored) {
      setPreferredChainState(parseInt(stored, 10));
      setHasPrompted(true);
    } else {
      setPreferredChainState(null);
      setHasPrompted(false);
    }
  }, []);

  const setPreferredChain = useCallback((chainId: number) => {
    if (typeof window === "undefined") return;

    localStorage.setItem(PREFERRED_CHAIN_KEY, chainId.toString());
    setPreferredChainState(chainId);
    setHasPrompted(true);
  }, []);

  const clearPreferredChain = useCallback(() => {
    if (typeof window === "undefined") return;

    localStorage.removeItem(PREFERRED_CHAIN_KEY);
    setPreferredChainState(null);
    setHasPrompted(false);
  }, []);

  return {
    preferredChain,
    setPreferredChain,
    clearPreferredChain,
    hasPrompted,
    shouldPrompt: !hasPrompted,
  };
}
