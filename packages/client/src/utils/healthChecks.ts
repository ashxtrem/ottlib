import type { HealthCheckResult, HealthReport, HealthState } from '@ottlib/shared';

/** The checks that need the user to look at them: anything not `ok`. */
export function attentionChecks(report: HealthReport | undefined): HealthCheckResult[] {
  return report?.checks.filter((check) => check.state !== 'ok') ?? [];
}

export const healthStateLabels: Record<HealthState, string> = { ok: 'OK', warn: 'Warning', fail: 'Problem' };

/** Tailwind classes for the state badge and the dot beside a check. */
export const healthStateClasses: Record<HealthState, string> = {
  ok: 'border-success/40 bg-success-soft text-success',
  warn: 'border-warning-border/50 bg-warning-soft text-warning',
  fail: 'border-error-border bg-error-soft text-error'
};

/** `GET /api/health`, or the same with `?fresh=1` to run every check again instead of using the server's cache. */
export function healthPath(fresh: boolean): string {
  return fresh ? '/api/health?fresh=1' : '/api/health';
}
