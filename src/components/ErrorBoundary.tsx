"use client";

import { Component, type ReactNode } from "react";
import { ErrorCode, getErrorInfo, isCriticalError } from "@/lib/errors";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isCritical = isCriticalError(ErrorCode.UNKNOWN);
      const errorInfo = getErrorInfo(ErrorCode.UNKNOWN);

      return (
        <div className="min-h-screen bg-[#061514] flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            <div className="rounded-2xl border border-red-500/20 bg-[#091615] p-6 text-center">
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

              <p className="text-sm text-gray-400 mb-4">
                {errorInfo.description}
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="text-left mb-4">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                    View error details
                  </summary>
                  <pre className="mt-2 text-xs text-red-300/80 overflow-auto max-h-32 p-2 bg-black/20 rounded">
                    {this.state.error.message}
                  </pre>
                </details>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={this.handleRetry}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                >
                  Try Again
                </button>
                {isCritical && (
                  <a
                    href="https://github.com/anomalyco/opencode/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    Report Issue
                  </a>
                )}
              </div>

              <p className="mt-4 text-xs text-gray-600">
                Error Code: {ErrorCode.UNKNOWN}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
