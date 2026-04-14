type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60_000;

function get<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

function set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function invalidate(pattern?: string): void {
  if (!pattern) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.includes(pattern)) {
      store.delete(key);
    }
  }
}

function size(): number {
  return store.size;
}

export const cache = { get, set, invalidate, size };

export const CACHE_TTL = {
  ETH_PRICE: 60_000,
  TOKEN_PRICE: 60_000,
  GAS: 30_000,
  OPPORTUNITIES: 60_000,
  LIFI_OPPORTUNITIES: 60_000,
  PROTOCOL_INFO: 300_000,
  BALANCE: 15_000,
  POSITIONS: 30_000,
  QUOTE: 15_000,
  MARKET_OVERVIEW: 120_000,
  PORTFOLIO_SUMMARY: 30_000,
} as const;
