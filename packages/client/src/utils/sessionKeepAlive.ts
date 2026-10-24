/** How often the watch page pings an open HLS session (the server sweeps one idle for 45 s). */
export const SESSION_KEEPALIVE_MS = 15_000;

export interface KeepAliveDeps {
  /** Sends the POST (no body); a rejection is swallowed. */
  post: (url: string) => Promise<unknown>;
  setInterval?: (callback: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
}

/** Posts `${sessionUrl}/keepalive` every 15 s, ignoring failures. Returns a function that stops the pings. */
export function startSessionKeepAlive(sessionUrl: string, deps: KeepAliveDeps): () => void {
  const start = deps.setInterval ?? ((callback, ms) => globalThis.setInterval(callback, ms));
  const clear = deps.clearInterval ?? ((handle) => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>));
  const url = `${sessionUrl}/keepalive`;
  const handle = start(() => {
    try {
      void Promise.resolve(deps.post(url)).catch(() => undefined);
    } catch {
      // A post that throws synchronously is as harmless as one that rejects.
    }
  }, SESSION_KEEPALIVE_MS);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    clear(handle);
  };
}
