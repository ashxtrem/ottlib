export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function readStored(storage: StorageLike, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; /* Storage can be unavailable (private mode). */ }
}

/** `window.localStorage` throws a SecurityError when storage is blocked; null then. */
export function safeStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** Holds what was picked when the browser store is blocked or refuses writes, so a pick still applies for the session. */
export function memoryStorage(): StorageLike & { clear(): void } {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, clear: () => data.clear() };
}

const sessionStore = memoryStorage();

/** Keys whose last write the browser store refused: the session copy is the truth for those. */
const sessionOnly = new Set<string>();

/** The browser store when it works, the session copy when it is blocked or refuses a write. */
export function pageStorage(): StorageLike {
  const real = safeStorage();
  return {
    getItem: (key) => (!real || sessionOnly.has(key) ? sessionStore.getItem(key) : readStored(real, key)),
    setItem: (key, value) => {
      sessionStore.setItem(key, value);
      try {
        if (!real) throw new Error('storage blocked');
        real.setItem(key, value);
        sessionOnly.delete(key);
      } catch { sessionOnly.add(key); }
    }
  };
}
