export enum ErrorCode {
  MISSING_WALLET = "MISSING_WALLET",
  MISSING_ENV = "MISSING_ENV",
  AGENT_TIMEOUT = "AGENT_TIMEOUT",
  AGENT_ERROR = "AGENT_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
  NETWORK_ERROR = "NETWORK_ERROR",
  CHAIN_UNSUPPORTED = "CHAIN_UNSUPPORTED",
  CHAIN_SWITCH_FAILED = "CHAIN_SWITCH_FAILED",
  TRANSACTION_FAILED = "TRANSACTION_FAILED",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  UNKNOWN = "UNKNOWN",
}

export interface AppError extends Error {
  code: ErrorCode;
  recoverable: boolean;
  action?: string;
}

export function createError(
  code: ErrorCode,
  message: string,
  recoverable: boolean = true,
  action?: string,
): AppError {
  const error = new Error(message) as AppError;
  error.code = code;
  error.recoverable = recoverable;
  error.action = action;
  return error;
}

export const ERROR_MESSAGES: Record<ErrorCode, { title: string; description: string; action: string }> = {
  [ErrorCode.MISSING_WALLET]: {
    title: "Wallet Not Connected",
    description: "Please connect your wallet to continue.",
    action: "Connect Wallet",
  },
  [ErrorCode.MISSING_ENV]: {
    title: "Configuration Error",
    description: "Required environment variables are missing. Please contact support.",
    action: "Contact Support",
  },
  [ErrorCode.AGENT_TIMEOUT]: {
    title: "Agent Timeout",
    description: "The AI agent took too long to respond. Please try again.",
    action: "Try Again",
  },
  [ErrorCode.AGENT_ERROR]: {
    title: "Agent Error",
    description: "An error occurred while processing your request.",
    action: "Try Again",
  },
  [ErrorCode.RATE_LIMITED]: {
    title: "Rate Limited",
    description: "Too many requests. Please wait a moment and try again.",
    action: "Wait & Retry",
  },
  [ErrorCode.NETWORK_ERROR]: {
    title: "Network Error",
    description: "Unable to connect to the network. Check your internet connection.",
    action: "Retry",
  },
  [ErrorCode.CHAIN_UNSUPPORTED]: {
    title: "Unsupported Network",
    description: "Please switch to a supported network to continue.",
    action: "Switch Network",
  },
  [ErrorCode.CHAIN_SWITCH_FAILED]: {
    title: "Network Switch Failed",
    description: "Unable to switch network. Please try manually in your wallet.",
    action: "OK",
  },
  [ErrorCode.TRANSACTION_FAILED]: {
    title: "Transaction Failed",
    description: "The transaction could not be completed. Please try again.",
    action: "Try Again",
  },
  [ErrorCode.INSUFFICIENT_BALANCE]: {
    title: "Insufficient Balance",
    description: "You don't have enough funds for this transaction.",
    action: "OK",
  },
  [ErrorCode.UNKNOWN]: {
    title: "Unexpected Error",
    description: "An unexpected error occurred. Please try again.",
    action: "Try Again",
  },
};

export function getErrorInfo(code: ErrorCode) {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN];
}

export function isCriticalError(code: ErrorCode): boolean {
  const criticalCodes = [ErrorCode.MISSING_ENV, ErrorCode.AGENT_ERROR, ErrorCode.UNKNOWN];
  return criticalCodes.includes(code);
}
