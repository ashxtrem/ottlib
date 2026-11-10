import type { HealthReport } from '@ottlib/shared';

const TAGS = { ok: 'OK  ', warn: 'WARN', fail: 'FAIL' } as const;

/** `npm run doctor` output: one line per check (its fix indented below), and exit code 1 when any check fails. */
export function doctorReport(report: HealthReport): { lines: string[]; exitCode: 0 | 1 } {
  const lines = report.checks.flatMap((check) => [`${TAGS[check.state]} ${check.label}: ${check.message}`, ...(check.fix ? [`     Fix: ${check.fix}`] : [])]);
  return { lines, exitCode: report.checks.some((check) => check.state === 'fail') ? 1 : 0 };
}
