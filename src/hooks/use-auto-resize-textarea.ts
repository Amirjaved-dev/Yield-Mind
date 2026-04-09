"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoResizeTextareaOptions {
  minHeight?: number;
  maxHeight?: number;
}

export function useAutoResizeTextarea(options: UseAutoResizeTextareaOptions = {}) {
  const { minHeight = 72, maxHeight = 300 } = options;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = useCallback((reset?: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (reset) {
      textarea.style.height = `${minHeight}px`;
      return;
    }

    textarea.style.height = `${minHeight}px`;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [minHeight, maxHeight]);

  useEffect(() => {
    adjustHeight();
  }, []);

  return { textareaRef, adjustHeight };
}
