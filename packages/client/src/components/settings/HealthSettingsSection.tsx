import type { HealthReport } from '@ottlib/shared';
import { useHealth } from '../../hooks/useHealth';
import { healthStateClasses, healthStateLabels } from '../../utils/healthChecks';

type HealthSectionViewProps = {
  report: HealthReport | undefined;
  error?: string;
  checking: boolean;
  onCheckAgain: () => void;
};

/** Each server check with its state, what it found and what to do about it. */
export function HealthSectionView({ report, error, checking, onCheckAgain }: HealthSectionViewProps) {
  return <section aria-labelledby="health-heading" className="rounded-xl border border-border bg-surface p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="health-heading" className="font-semibold">Server health</h2><p className="mt-1 text-sm text-muted">Disk space, ffmpeg, folders, database and updates, checked by the server.</p></div>
      <button type="button" onClick={onCheckAgain} disabled={checking} className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{checking ? 'Checking…' : 'Check again'}</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    {!report && !error && <p className="mt-3 text-sm text-muted">Checking the server…</p>}
    {report && <ul className="mt-4 space-y-2">
      {report.checks.map((check) => <li key={check.id} className="flex flex-col gap-2 rounded-lg border border-border bg-field p-3 sm:flex-row sm:items-start sm:gap-3">
        <span className={`inline-flex w-fit shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${healthStateClasses[check.state]}`}>{healthStateLabels[check.state]}</span>
        <div className="min-w-0 text-sm">
          <p className="font-medium">{check.label}</p>
          <p className="mt-0.5 text-muted">{check.message}</p>
          {check.fix && <p className="mt-1 text-xs"><span className="font-medium">Fix: </span>{check.fix}</p>}
        </div>
      </li>)}
    </ul>}
  </section>;
}

export function HealthSettingsSection() {
  const { query, checkAgain } = useHealth();
  const error = checkAgain.error?.message ?? (query.data ? undefined : query.error?.message);
  return <HealthSectionView report={query.data} error={error} checking={checkAgain.isPending || (query.isFetching && !query.data)} onCheckAgain={() => checkAgain.mutate()} />;
}
