import { useMemo, useState } from 'react';
import { formatBytes, type TorrentResult } from '@ottlib/shared';
import { TorrentResultRow, statusClass, statusLabel } from './TorrentResultRow';
import { TorrentSendButton } from './TorrentSendButton';

type Sort = 'seeders' | 'size' | 'date';

function sortValue(result: TorrentResult, sort: Sort): number {
  if (sort === 'size') return result.fileSize ?? -1;
  if (sort === 'date') return result.publishedAt ? new Date(result.publishedAt).getTime() || -1 : -1;
  return result.nbSeeders && result.nbSeeders > 0 ? result.nbSeeders : -1;
}

export function TorrentResultTable({ results }: { results: TorrentResult[] }) {
  const [sort, setSort] = useState<Sort>('seeders');
  const sorted = useMemo(() => [...results].sort((left, right) => sortValue(right, sort) - sortValue(left, sort) || left.fileName.localeCompare(right.fileName)), [results, sort]);
  const heading = (label: string, value: Sort) => <button type="button" onClick={() => setSort(value)} className={`relative font-medium transition-colors duration-instant hover:text-accent after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:bg-accent after:transition-transform after:duration-base after:ease-standard ${sort === value ? 'text-accent after:scale-x-100' : 'after:scale-x-0'}`}>{label}</button>;
  return <>
    <div className="mb-3 flex items-center justify-between gap-3 text-sm text-muted"><span>{results.length} result{results.length === 1 ? '' : 's'}</span><label>Sort <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="ml-1 rounded border border-border bg-field px-2 py-1 text-foreground"><option value="seeders">Seeders</option><option value="size">Size</option><option value="date">Date</option></select></label></div>
    <div className="space-y-3 md:hidden">{sorted.map((result) => <TorrentResultRow key={result.fileUrl} result={result} />)}</div>
    <div className="hidden overflow-x-auto rounded-xl border border-border md:block"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-surface-raised text-muted"><tr><th className="p-3">Release</th><th className="p-3">Quality</th><th className="p-3">{heading('Size', 'size')}</th><th className="p-3">{heading('Seeders', 'seeders')}</th><th className="p-3">Leechers</th><th className="p-3">{heading('Date', 'date')}</th><th className="p-3">Engine</th><th className="p-3">Library</th><th className="p-3">Actions</th></tr></thead><tbody key={sort} className="animate-fade-in">{sorted.map((result) => {
      const chips = [result.quality.resolution, result.quality.source, result.quality.codec, result.quality.group].filter(Boolean); const unknownSeeds = !result.nbSeeders || result.nbSeeders < 0;
      return <tr key={result.fileUrl} className={`border-t border-border align-top ${unknownSeeds ? 'opacity-60' : ''}`}><td className="max-w-xs break-words p-3 font-medium">{result.fileName}</td><td className="p-3"><div className="flex max-w-36 flex-wrap gap-1">{chips.length ? chips.map((chip) => <span key={chip} className="rounded bg-field px-1.5 py-0.5 text-xs">{chip}</span>) : '—'}</div></td><td className="p-3 whitespace-nowrap tabular-nums">{formatBytes(result.fileSize)}</td><td className="p-3 tabular-nums">{result.nbSeeders ?? '—'}</td><td className="p-3 tabular-nums">{result.nbLeechers ?? '—'}</td><td className="p-3 whitespace-nowrap tabular-nums">{result.publishedAt ? new Date(result.publishedAt).toLocaleDateString() : '—'}</td><td className="p-3">{result.engines.join(', ') || '—'}</td><td className="p-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(result.libraryStatus)}`}>{statusLabel(result.libraryStatus)}</span></td><td className="p-3"><TorrentSendButton url={result.fileUrl} /></td></tr>;
    })}</tbody></table></div>
  </>;
}
