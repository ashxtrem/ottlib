import type { HealthState } from '@ottlib/shared';

export interface HealthResult {
  state: HealthState;
  message: string;
  /** What the user can do about a `warn` or `fail`. */
  fix?: string;
}

/** One health check (one file per check under `checks/`, registered in `healthChecks.ts`). */
export interface HealthCheck {
  id: string;
  label: string;
  run(): Promise<HealthResult>;
}
