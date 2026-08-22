import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Folder, ScanRun } from '@ottlib/shared';

interface LibraryEmptyStateProps {
  folders: Folder[];
  scanHistory: ScanRun[];
  tmdbConfigured: boolean;
  filtersActive: boolean;
  scanning: boolean;
  onStartScan: () => void;
  onClearFilters: () => void;
}

function Step({ complete, number, title, description, action }: { complete: boolean; number: number; title: string; description: string; action?: ReactNode }) {
  return <li className="flex items-start gap-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${complete ? 'bg-success text-success-soft' : 'bg-surface-raised text-muted'}`}>{complete ? '✓' : number}</span><div className="min-w-0"><h3 className="font-medium text-foreground">{title}</h3><p className="mt-0.5 text-sm text-muted">{description}</p>{action && <div className="mt-2">{action}</div>}</div></li>;
}

function SetupCard({ folders, scanHistory, tmdbConfigured, scanning, onStartScan }: Omit<LibraryEmptyStateProps, 'filtersActive' | 'onClearFilters'>) {
  const hasFolders = folders.length > 0;
  const hasCompletedScan = scanHistory.some((run) => run.status === 'completed');
  const latestScan = scanHistory[0];
  const nextAction = !hasFolders ? <Link to="/settings#scan-folders" className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">Add a folder</Link>
    : !tmdbConfigured ? <Link to="/settings#tmdb-api-key" className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">Add TMDb key</Link>
      : <button type="button" onClick={onStartScan} disabled={scanning} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{scanning ? 'Scanning…' : 'Scan your library'}</button>;
  return <section className="rounded-2xl border border-accent-soft-border bg-surface p-6 shadow-lg shadow-accent-soft/20" aria-labelledby="library-setup-title"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">First-time setup</p><h2 id="library-setup-title" className="mt-2 text-2xl font-bold">Build your library</h2><p className="mt-2 max-w-2xl text-muted">Point OttLib at your videos, add a TMDb key for artwork and metadata, then scan. Your library stays on this device.</p>
    <ol className="mt-6 grid gap-5 md:grid-cols-3"><Step number={1} complete={hasFolders} title="Add a folder" description={hasFolders ? `${folders.length} folder${folders.length === 1 ? '' : 's'} ready to scan.` : 'Choose the folder where your videos live.'} /><Step number={2} complete={tmdbConfigured} title="Add a TMDb key" description={tmdbConfigured ? 'Your metadata source is connected.' : 'Use a free TMDb key to match titles and artwork.'} /><Step number={3} complete={hasCompletedScan} title="Scan your library" description={hasCompletedScan ? `Last scan found ${latestScan?.filesFound ?? 0} media file${latestScan?.filesFound === 1 ? '' : 's'}.` : hasFolders ? 'No files scanned yet.' : 'Available after you add a folder.'} /></ol>
    <div className="mt-6">{nextAction}</div>
  </section>;
}

export function LibraryEmptyState({ folders, scanHistory, tmdbConfigured, filtersActive, scanning, onStartScan, onClearFilters }: LibraryEmptyStateProps) {
  const hasCompletedScan = scanHistory.some((run) => run.status === 'completed');
  const setupComplete = folders.length > 0 && tmdbConfigured && hasCompletedScan;
  if (!setupComplete) return <SetupCard folders={folders} scanHistory={scanHistory} tmdbConfigured={tmdbConfigured} scanning={scanning} onStartScan={onStartScan} />;
  if (filtersActive) return <section className="rounded-xl border border-dashed border-border p-12 text-center"><h2 className="text-lg font-semibold">No titles match these filters</h2><p className="mt-2 text-sm text-muted">Try broadening your search or clearing the active filters.</p><button type="button" onClick={onClearFilters} className="mt-4 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised">Clear filters</button></section>;
  const latestScan = scanHistory[0];
  return <section className="rounded-xl border border-dashed border-border p-12 text-center"><h2 className="text-lg font-semibold">No videos found yet</h2><p className="mt-2 text-sm text-muted">Your last scan found {latestScan?.filesFound ?? 0} media file{latestScan?.filesFound === 1 ? '' : 's'}. Check your scan folders, then try again.</p><div className="mt-4 flex flex-wrap justify-center gap-3"><button type="button" onClick={onStartScan} disabled={scanning} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{scanning ? 'Scanning…' : 'Scan your library'}</button><Link to="/settings#scan-folders" className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised">Manage folders</Link></div></section>;
}
