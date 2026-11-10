import type { HealthCheckResult, HealthReport } from '@ottlib/shared';
import type { HealthCheck, HealthResult } from './HealthCheck.js';

export const HEALTH_CHECK_TIMEOUT_MS = 5_000;
export const HEALTH_CACHE_MS = 60_000;

export interface HealthServiceOptions {
  timeoutMs?: number;
  cacheMs?: number;
  now?: () => Date;
}

/** Runs every registered check in parallel (each bounded by a timeout) and keeps the report for a minute. */
export class HealthService {
  private cached: { at: number; report: Promise<HealthReport> } | undefined;
  private readonly timeoutMs: number;
  private readonly cacheMs: number;
  private readonly now: () => Date;

  public constructor(private readonly checks: () => HealthCheck[], options: HealthServiceOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? HEALTH_CHECK_TIMEOUT_MS;
    this.cacheMs = options.cacheMs ?? HEALTH_CACHE_MS;
    this.now = options.now ?? (() => new Date());
  }

  /** The cached report when it is under a minute old, unless `fresh`. */
  public run(fresh = false): Promise<HealthReport> {
    const at = this.now().getTime();
    if (!fresh && this.cached && at - this.cached.at < this.cacheMs) return this.cached.report;
    const report = this.runAll();
    this.cached = { at, report };
    return report;
  }

  private async runAll(): Promise<HealthReport> {
    const checks = await Promise.all(this.checks().map((check) => this.runOne(check)));
    return { checkedAt: this.now().toISOString(), checks };
  }

  private async runOne(check: HealthCheck): Promise<HealthCheckResult> {
    const result = await this.bounded(check).catch((error: unknown): HealthResult => ({ state: 'fail', message: error instanceof Error ? error.message : String(error) }));
    return { id: check.id, label: check.label, state: result.state, message: result.message, ...(result.fix ? { fix: result.fix } : {}) };
  }

  /** A check that hasn't answered within the timeout reports `warn`. */
  private bounded(check: HealthCheck): Promise<HealthResult> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<HealthResult>((resolve) => {
      timer = setTimeout(() => resolve({ state: 'warn', message: `No answer within ${Math.round(this.timeoutMs / 1000)} s.` }), this.timeoutMs);
    });
    return Promise.race([Promise.resolve().then(() => check.run()), timeout]).finally(() => clearTimeout(timer));
  }
}
