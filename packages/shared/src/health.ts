import { z } from 'zod';

/** `ok` needs nothing, `warn` works with something missing or stale, `fail` is broken and needs a fix. */
export const healthStateSchema = z.enum(['ok', 'warn', 'fail']);
export type HealthState = z.infer<typeof healthStateSchema>;

export const healthCheckResultSchema = z.object({
  /** Stable check id, e.g. `disk-space`. */
  id: z.string(),
  label: z.string(),
  state: healthStateSchema,
  message: z.string(),
  /** What to do about a `warn` or `fail`; absent when there is nothing to do. */
  fix: z.string().optional()
});
export type HealthCheckResult = z.infer<typeof healthCheckResultSchema>;

/** `GET /api/health`: every registered check, in order, as of `checkedAt`. */
export const healthReportSchema = z.object({
  checkedAt: z.string(),
  checks: z.array(healthCheckResultSchema)
});
export type HealthReport = z.infer<typeof healthReportSchema>;
