import type { HealthCheckResult } from '@ottlib/shared';
import { Link } from 'react-router-dom';
import { useHealth } from '../hooks/useHealth';
import { attentionChecks, healthStateLabels } from '../utils/healthChecks';

/** Lists the checks that are warning or failing; renders nothing when all is well. */
export function HomeAttentionCardView({ checks }: { checks: HealthCheckResult[] }) {
  if (!checks.length) return null;
  const failing = checks.some((check) => check.state === 'fail');
  return <section aria-labelledby="attention-heading" className={`rounded-xl border p-4 ${failing ? 'border-error-border bg-error-soft/30' : 'border-warning-border/50 bg-warning-soft'}`}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 id="attention-heading" className="font-semibold">Needs attention</h2>
      <Link to="/settings" className="text-sm font-medium text-accent hover:underline">Open Settings</Link>
    </div>
    <ul className="mt-2 space-y-1 text-sm">
      {checks.map((check) => <li key={check.id}><span className="font-medium">{check.label}</span> <span className="text-xs uppercase text-muted">({healthStateLabels[check.state]})</span><span className="text-muted"> — {check.message}</span></li>)}
    </ul>
  </section>;
}

export function HomeAttentionCard() {
  const { query } = useHealth();
  return <HomeAttentionCardView checks={attentionChecks(query.data)} />;
}
