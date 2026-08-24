import type { ActiveTorrentDownloads, TorrentDownload } from '@ottlib/shared';

export function ActiveTorrentDownloads({ downloads, loading }: { downloads?: ActiveTorrentDownloads; loading: boolean }) {
  if (loading && !downloads) return <section className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">qBittorrent downloads</h2><p className="mt-2 text-sm text-muted">Loading active downloads…</p></section>;
  if (!downloads) return null;
  if (downloads.status === 'not-configured') return <section className="rounded-xl border border-warning-border bg-warning-soft p-5"><h2 className="font-semibold text-warning">Set up qBittorrent to see downloads</h2><p className="mt-1 text-sm text-muted">{downloads.message}</p></section>;
  if (downloads.status !== 'ok') return <section className="rounded-xl border border-error/30 bg-error-soft p-5"><h2 className="font-semibold text-error">qBittorrent downloads unavailable</h2><p className="mt-1 text-sm text-muted">{downloads.message ?? 'Could not load active downloads.'}</p></section>;
  if (!downloads.torrents.length) return <section className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">qBittorrent downloads</h2><p className="mt-1 text-sm text-muted">No active torrents in the OttLib category.</p></div>{loading && <span className="text-xs text-muted">Refreshing…</span>}</div></section>;
  return <section className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">qBittorrent downloads</h2><p className="mt-1 text-sm text-muted">{downloads.torrents.length} active torrent{downloads.torrents.length === 1 ? '' : 's'} in the OttLib category.</p></div>{loading && <span className="text-xs text-muted">Refreshing…</span>}</div><div className="mt-4 space-y-4">{downloads.torrents.map((torrent) => <TorrentDownloadCard key={torrent.hash} torrent={torrent} />)}</div></section>;
}

function TorrentDownloadCard({ torrent }: { torrent: TorrentDownload }) {
  const progress = Math.round(torrent.progress * 100);
  return <article className="rounded-lg border border-border bg-field p-4"><div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2"><h3 className="min-w-0 flex-1 break-words font-medium">{torrent.name}</h3><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateClass(torrent.state)}`}>{stateLabel(torrent.state)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-raised" role="progressbar" aria-label={`${torrent.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} /></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted"><span className="font-medium text-foreground tabular-nums">{progress}%</span><span className="tabular-nums">{formatBytes(torrent.downloadedBytes)} / {formatBytes(torrent.totalBytes)}</span><span className="tabular-nums">{formatSpeed(torrent.downloadSpeed)}</span><span>ETA {formatEta(torrent.etaSeconds)}</span><span>Seeds {torrent.seeds ?? '—'} · Peers {torrent.peers ?? '—'}</span></div>{torrent.error && <p className="mt-2 text-sm text-error">{torrent.error}</p>}</article>;
}

function stateLabel(state: string): string {
  const labels: Record<string, string> = { downloading: 'Downloading', forcedDL: 'Downloading', queuedDL: 'Queued', stalledDL: 'Stalled', metaDL: 'Fetching metadata', checkingDL: 'Checking', checkingResumeData: 'Checking', allocating: 'Allocating', error: 'Error' };
  return labels[state] ?? state.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function stateClass(state: string): string {
  if (state === 'error') return 'bg-error-soft text-error';
  if (state === 'stalledDL') return 'bg-warning-soft text-warning';
  return 'bg-accent-soft text-accent';
}

function formatBytes(value: number): string {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB']; const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** exponent).toFixed(exponent ? 1 : 0)} ${units[exponent]}`;
}

function formatSpeed(value: number): string { return value ? `${formatBytes(value)}/s` : '0 B/s'; }
function formatEta(value: number | null): string {
  if (value === null || value >= 8_640_000) return '—';
  const hours = Math.floor(value / 3600); const minutes = Math.floor((value % 3600) / 60); const seconds = value % 60;
  return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m` : `${seconds}s`;
}
