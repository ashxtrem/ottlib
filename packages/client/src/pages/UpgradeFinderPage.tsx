import { Link } from 'react-router-dom';
import type { Settings, UpgradeCandidate, UpgradeReason } from '@ottlib/shared';
import { focusRing } from '../components/interactionStyles';
import { useSettings } from '../hooks/useSettings';
import { useUpgradeCandidates } from '../hooks/useUpgradeCandidates';

export function upgradeReasonLabel(reason: UpgradeReason, preferred: Settings['torrentPreferredResolution']): string {
  return reason === 'resolution' ? `Below your preferred ${preferred ?? 'resolution'}` : 'Old video codec';
}

export function findBetterPath(movie: { title: string; year: number | null }): string {
  const params = new URLSearchParams({ q: movie.title });
  if (movie.year) params.set('year', String(movie.year));
  return `/torrents?${params.toString()}`;
}

interface UpgradeFinderViewProps {
  candidates: UpgradeCandidate[] | undefined;
  preferredResolution: Settings['torrentPreferredResolution'];
  loading?: boolean;
  error?: string;
}

export function UpgradeFinderView({ candidates, preferredResolution, loading = false, error }: UpgradeFinderViewProps) {
  return <section className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold">Upgrade finder</h1>
      <p className="mt-1 text-sm text-muted">Titles in your library that could be replaced with a better release.</p>
      <Link to="/torrents" className={`mt-2 inline-block text-sm text-accent hover:underline ${focusRing}`}>Back to torrent search</Link>
    </div>
    {preferredResolution === null && <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">No preferred resolution is set, so only titles in an old video codec are listed. Pick one under <Link to="/settings" className="text-accent hover:underline">Settings → Torrent search</Link> to also find low-resolution titles.</p>}
    {error && <p className="rounded-lg border border-error/30 bg-error-soft p-3 text-sm text-error">{error}</p>}
    {loading && !candidates && <p className="text-sm text-muted">Looking for upgrades…</p>}
    {candidates && candidates.length === 0 && <section className="rounded-xl border border-dashed border-border p-10 text-center"><h2 className="font-semibold">Nothing to upgrade</h2><p className="mt-2 text-sm text-muted">No titles match your preferences right now.</p></section>}
    {candidates && candidates.length > 0 && <ul className="space-y-3">{candidates.map(({ movie, reason }) => <li key={movie.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><Link to={`/movie/${movie.id}`} className={`break-words font-medium hover:text-accent ${focusRing}`}>{movie.title}{movie.year ? ` (${movie.year})` : ''}</Link><p className="mt-1 text-sm text-muted">{upgradeReasonLabel(reason, preferredResolution)}{movie.resolution ? ` · now ${movie.resolution}` : ''}</p></div>
      <Link to={findBetterPath(movie)} className={`inline-flex shrink-0 justify-center rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised ${focusRing}`}>Find better</Link>
    </li>)}</ul>}
  </section>;
}

export function UpgradeFinderPage() {
  const settings = useSettings();
  const enabled = settings.data?.torrentSearchEnabled === true;
  const candidates = useUpgradeCandidates(enabled);
  if (!settings.data) return null;
  if (!enabled) return <section className="rounded-xl border border-dashed border-border p-12 text-center"><h1 className="text-lg font-semibold">Torrent search is off</h1><p className="mt-2 text-sm text-muted">The upgrade finder is part of the optional qBittorrent integration. Turn it on under Settings → Torrent search.</p><Link to="/settings" className="mt-4 inline-flex rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised">Open settings</Link></section>;
  return <UpgradeFinderView candidates={candidates.data} preferredResolution={settings.data.torrentPreferredResolution} loading={candidates.isLoading} error={candidates.error?.message} />;
}
