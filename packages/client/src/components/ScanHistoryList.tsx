import type { ScanRun } from '@ottlib/shared';

function scanTimestamp(value: string | null): number | null {
  if (!value) return null;
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatTime(value: string | null): string {
  const timestamp = scanTimestamp(value);
  return timestamp === null ? value ?? 'In progress' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  const started = scanTimestamp(startedAt); const finished = scanTimestamp(finishedAt);
  if (started === null || finished === null) return finishedAt ? 'Unavailable' : 'In progress';
  const totalSeconds = Math.max(0, Math.floor((finished - started) / 1_000));
  const hours = Math.floor(totalSeconds / 3_600); const minutes = Math.floor((totalSeconds % 3_600) / 60); const seconds = totalSeconds % 60;
  return [hours && `${hours}h`, (hours || minutes) && `${minutes}m`, `${seconds}s`].filter(Boolean).join(' ');
}

export function ScanHistoryList({ runs }: { runs: ScanRun[] | undefined }) {
  if (!runs?.length) return <p className="mt-3 text-sm text-muted">No scans yet.</p>;
  return <ul className="mt-3 space-y-2 text-sm">{runs.map((run) => <li key={run.id}>
    <details open={run.status === 'failed'} className="rounded bg-field px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className={run.status === 'completed' ? 'text-success' : run.status === 'failed' ? 'text-error' : 'text-accent'}>{run.status}</span><span className="flex items-center gap-2 text-right text-muted"><span>{run.filesProcessed} files · {formatTime(run.startedAt)}</span><span className="text-accent">Details</span></span></summary>
      <dl className="mt-3 grid gap-x-4 gap-y-2 border-t border-border pt-3 text-muted sm:grid-cols-[auto_1fr]"><dt>Started</dt><dd className="text-foreground">{formatTime(run.startedAt)}</dd><dt>Finished</dt><dd className="text-foreground">{formatTime(run.finishedAt)}</dd><dt>Duration</dt><dd className="text-foreground">{formatDuration(run.startedAt, run.finishedAt)}</dd>{run.status === 'failed' && <><dt>Error summary</dt><dd className="whitespace-pre-wrap break-words text-error">{run.errorSummary ?? 'No error summary was recorded.'}</dd></>}</dl>
    </details>
  </li>)}</ul>;
}
