"use client";

import { useEffect, useState } from "react";

interface Vault {
  name: string;
  apy: number;
  chain: string;
  protocol: string;
  tvl?: number;
}

export function VaultList() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVaults() {
      try {
        const res = await fetch("/api/vaults");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load vaults");
        }
        const data = await res.json();
        const vaults: Vault[] = (data.opportunities || []).map((opp: Record<string, unknown>) => ({
          name: (opp.name as string) || "Unknown",
          apy: (opp.apy as number) ?? 0,
          chain: (opp.chain as string) || "Unknown",
          protocol: (opp.protocol as string) || "Unknown",
          tvl: opp.tvl as number | undefined,
        }));
        setVaults(vaults);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load vaults");
      } finally {
        setLoading(false);
      }
    }
    fetchVaults();
  }, []);

  if (loading) {
    return (
      <div className="w-full text-center py-8 text-zinc-500">Loading vaults...</div>
    );
  }

  if (error) {
    return (
      <div className="w-full text-center py-8 text-red-500">{error}</div>
    );
  }

  if (vaults.length === 0) {
    return (
      <div className="w-full text-center py-8 text-zinc-500">No vaults found</div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Name</th>
            <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">APY</th>
            <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Chain</th>
            <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Protocol</th>
          </tr>
        </thead>
        <tbody>
          {vaults.map((vault, i) => (
            <tr
              key={i}
              className="border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
            >
              <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">{vault.name}</td>
              <td className="py-3 px-4 text-green-600 font-medium">
                {vault.apy != null ? `${vault.apy.toFixed(2)}%` : "—"}
              </td>
              <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{vault.chain}</td>
              <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{vault.protocol}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
