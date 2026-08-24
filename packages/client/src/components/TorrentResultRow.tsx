import { formatBytes, type TorrentResult } from '@ottlib/shared';
import { TorrentSendButton } from './TorrentSendButton';

function statusLabel(status: TorrentResult['libraryStatus']): string { return status === 'owned' ? 'Owned' : status === 'missing' ? 'File missing' : 'New'; }
function statusClass(status: TorrentResult['libraryStatus']): string { return status === 'owned' ? 'bg-success-soft text-success' : status === 'missing' ? 'bg-warning-soft text-warning' : 'bg-accent-soft text-accent-soft-foreground'; }

export function TorrentResultRow({ result }: { result: TorrentResult }) {
  const chips = [result.quality.resolution, result.quality.source, result.quality.codec, result.quality.group].filter(Boolean);
  const unknownSeeds = !result.nbSeeders || result.nbSeeders < 0;
  return <article className={`rounded-xl border border-border bg-surface p-4 ${unknownSeeds ? 'opacity-65' : ''}`}>
    <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words font-medium">{result.fileName}</h3><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(result.libraryStatus)}`}>{statusLabel(result.libraryStatus)}</span></div>
    {chips.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{chips.map((chip) => <span key={chip} className="rounded bg-field px-1.5 py-0.5 text-xs text-muted">{chip}</span>)}</div>}
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-muted"><div><dt className="sr-only">Size</dt><dd>{formatBytes(result.fileSize)}</dd></div><div><dt className="sr-only">Seeders and leechers</dt><dd>{result.nbSeeders ?? '—'} seeders · {result.nbLeechers ?? '—'} leechers</dd></div><div className="col-span-2"><dt className="sr-only">Engines</dt><dd>{result.engines.join(', ') || 'Unknown engine'}</dd></div></dl>
    <div className="mt-3"><TorrentSendButton url={result.fileUrl} /></div>
  </article>;
}

export { statusClass, statusLabel };
