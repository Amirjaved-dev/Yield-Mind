import toast from "react-hot-toast";

export interface ToastOptions {
  duration?: number;
  icon?: string;
}

const DEFAULT_DURATION = 4000;

export const showToast = {
  success: (message: string, options?: ToastOptions) => {
    toast.success(message, {
      duration: options?.duration || DEFAULT_DURATION,
      icon: options?.icon || "✓",
      style: {
        background: "#091615",
        border: "1px solid rgba(52, 211, 153, 0.2)",
        color: "#fff",
      },
    });
  },

  error: (message: string, options?: ToastOptions) => {
    toast.error(message, {
      duration: options?.duration || 5000,
      icon: options?.icon || "✕",
      style: {
        background: "#091615",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        color: "#fff",
      },
    });
  },

  loading: (message: string) => {
    return toast.loading(message, {
      style: {
        background: "#091615",
        border: "1px solid rgba(136, 255, 247, 0.1)",
        color: "#fff",
      },
    });
  },

  dismiss: (toastId?: string) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  },

  info: (message: string, options?: ToastOptions) => {
    toast(message, {
      duration: options?.duration || DEFAULT_DURATION,
      icon: options?.icon || "ℹ",
      style: {
        background: "#091615",
        border: "1px solid rgba(136, 255, 247, 0.1)",
        color: "#fff",
      },
    });
  },

  walletConnected: (address: string) => {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    showToast.success(`Wallet connected: ${short}`);
  },

  walletDisconnected: () => {
    showToast.info("Wallet disconnected");
  },

  chainSwitched: (chainName: string) => {
    showToast.success(`Switched to ${chainName}`);
  },

  chainSwitchFailed: () => {
    showToast.error("Failed to switch network. Please try manually.");
  },

  transaction: (hash: string, chain: string, chainId: number) => {
    const explorerUrls: Record<number, string> = {
      1: "https://etherscan.io",
      42161: "https://arbiscan.io",
      10: "https://optimistic.etherscan.io",
      8453: "https://basescan.org",
      137: "https://polygonscan.com",
      43114: "https://snowtrace.io",
      56: "https://bscscan.com",
      11155111: "https://sepolia.etherscan.io",
    };

    const baseUrl = explorerUrls[chainId] || "https://etherscan.io";
    const url = `${baseUrl}/tx/${hash}`;
    const shortHash = `${hash.slice(0, 6)}...${hash.slice(-4)}`;

    toast.success(
      <div className="flex flex-col gap-1">
        <span>Transaction submitted</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#88fff7] hover:underline"
        >
          View {shortHash} →
        </a>
      </div>,
      {
        duration: 6000,
        style: {
          background: "#091615",
          border: "1px solid rgba(52, 211, 153, 0.2)",
          color: "#fff",
        },
      }
    );
  },

  copied: () => {
    showToast.success("Copied to clipboard", { duration: 2000 });
  },
};
