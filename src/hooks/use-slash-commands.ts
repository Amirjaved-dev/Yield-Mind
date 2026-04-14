"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  isSlashCommand,
  executeSlashCommand,
  getMatchingCommands,
  type SlashCommandResult,
  type SlashCommand,
} from "@/lib/slash-commands";

export function useSlashCommands() {
  const [showMenu, setShowMenu] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const matchedCommands = useMemo(() => getMatchingCommands(menuQuery), [menuQuery]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [matchedCommands.length]);

  const handleInputChange = useCallback((value: string) => {
    if (value.startsWith("/") || value.trim() === "") {
      setShowMenu(true);
      setMenuQuery(value);
    } else {
      setShowMenu(false);
      setMenuQuery("");
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): { handled: boolean; commandResult?: SlashCommandResult } => {
      if (!showMenu || matchedCommands.length === 0) return { handled: false };

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % matchedCommands.length);
        return { handled: true };
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + matchedCommands.length) % matchedCommands.length);
        return { handled: true };
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        const selected = matchedCommands[selectedIndex];
        if (selected) {
          setShowMenu(false);
          setMenuQuery("");
          setSelectedIndex(0);
          const result = executeSlashCommand(`/${selected.name}`);
          return { handled: true, commandResult: result };
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMenu(false);
        setMenuQuery("");
        return { handled: true };
      }

      return { handled: false };
    },
    [showMenu, matchedCommands, selectedIndex],
  );

  const tryExecute = useCallback((input: string): SlashCommandResult | null => {
    if (!isSlashCommand(input)) return null;
    setShowMenu(false);
    setMenuQuery("");
    return executeSlashCommand(input);
  }, []);

  const selectCommand = useCallback((command: SlashCommand): SlashCommandResult => {
    setShowMenu(false);
    setMenuQuery("");
    setSelectedIndex(0);
    return executeSlashCommand(`/${command.name}`);
  }, []);

  const closeMenu = useCallback(() => {
    setShowMenu(false);
    setMenuQuery("");
  }, []);

  return {
    showMenu,
    matchedCommands,
    selectedIndex,
    setSelectedIndex,
    handleInputChange,
    handleKeyDown,
    tryExecute,
    selectCommand,
    closeMenu,
    inputRef,
  };
}
