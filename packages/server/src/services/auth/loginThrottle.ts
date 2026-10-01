/** Failed attempts allowed before a client has to wait. */
const freeAttempts = 5;
const baseLockMs = 30_000;
const maxLockMs = 60 * 60_000;

/**
 * Slows PIN guessing per client address: after a few wrong PINs each further failure doubles the wait
 * (30 s, 1 min, 2 min … capped at an hour). A correct PIN clears the record.
 */
export class LoginThrottle {
  private readonly clients = new Map<string, { failures: number; lockedUntil: number }>();
  public constructor(private readonly now: () => number = Date.now) {}

  /** Milliseconds this client must still wait, or 0 when it may try. */
  public waitMs(client: string): number { return Math.max(0, (this.clients.get(client)?.lockedUntil ?? 0) - this.now()); }

  public failed(client: string): void {
    const failures = (this.clients.get(client)?.failures ?? 0) + 1;
    const lockMs = failures < freeAttempts ? 0 : Math.min(baseLockMs * 2 ** (failures - freeAttempts), maxLockMs);
    this.clients.set(client, { failures, lockedUntil: this.now() + lockMs });
  }

  public succeeded(client: string): void { this.clients.delete(client); }
}
