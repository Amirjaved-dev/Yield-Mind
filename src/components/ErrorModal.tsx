"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ErrorCode, getErrorInfo, type AppError } from "@/lib/errors";

interface ErrorModalProps {
  isOpen: boolean;
  error: AppError | null;
  onClose: () => void;
  onRetry?: () => void;
}

export function ErrorModal({ isOpen, error, onClose, onRetry }: ErrorModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  if (!isOpen || !error) return null;

  const errorInfo = getErrorInfo(error.code);
  const handleRetry = () => {
    onClose();
    if (onRetry) {
      onRetry();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-md rounded-2xl border border-red-500/20 bg-[#091615] p-6 shadow-2xl transition-all duration-200 ${
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <svg
              className="h-6 w-6 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h2 className="text-lg font-semibold text-white mb-2">
            {errorInfo.title}
          </h2>

          <p className="text-sm text-gray-400 mb-6">
            {error.message || errorInfo.description}
          </p>

          <div className="flex gap-3 justify-center">
            {error.recoverable && (
              <button
                onClick={handleRetry}
                className="px-4 py-2 rounded-lg bg-[#88fff7]/10 border border-[#88fff7]/20 text-sm text-[#88fff7] hover:bg-[#88fff7]/20 transition-colors"
              >
                {errorInfo.action}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 transition-colors"
            >
              Dismiss
            </button>
          </div>

          <p className="mt-4 text-xs text-gray-600">
            Error Code: {error.code}
          </p>
        </div>
      </div>
    </div>
  );
}
