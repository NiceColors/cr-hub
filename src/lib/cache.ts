export type TtlCacheOptions = {
  now?: () => number;
};

type Entry<T> = { value: T; expiresAtMs: number };

export function createTtlCache<T>(opts: TtlCacheOptions = {}) {
  const now = opts.now ?? (() => Date.now());
  const store = new Map<string, Entry<T>>();

  function get(key: string): T | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAtMs <= now()) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key: string, value: T, ttlMs: number) {
    store.set(key, { value, expiresAtMs: now() + ttlMs });
  }

  function clear() {
    store.clear();
  }

  return { get, set, clear };
}

