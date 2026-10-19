import { useLayoutEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ErrorState } from '../components/ErrorState';
import { HomeRowSection } from '../components/HomeRowSection';
import { SkeletonPosterGrid } from '../components/Skeleton';
import { getLibraryRestoreScrollPosition } from '../hooks/useBackToLibrary';
import { useHiddenTitles } from '../hooks/useHiddenTitles';
import { useHomeRows } from '../hooks/useHomeRows';

/** Landing screen: the same rows the TV and phone apps open on. The full grid lives at /library. */
export function HomePage() {
  const { state } = useLocation();
  const homeRows = useHomeRows();
  const { isHidden } = useHiddenTitles();
  const rows = useMemo(() => homeRows.data?.map((row) => ({ ...row, items: row.items.filter((movie) => !isHidden(movie)) })).filter((row) => row.items.length > 0), [homeRows.data, isHidden]);
  const restoreScrollY = getLibraryRestoreScrollPosition(state);
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!rows || restored.current || restoreScrollY === undefined) return;
    restored.current = true;
    window.scrollTo({ top: restoreScrollY, behavior: 'auto' });
  }, [rows, restoreScrollY]);

  if (homeRows.isLoading) return <SkeletonPosterGrid />;
  if (!rows) return <ErrorState resource="library" error={homeRows.error} retrying={homeRows.isFetching} onRetry={homeRows.refetch} />;
  if (!rows.length) return <section className="rounded-xl border border-dashed border-border p-12 text-center"><h1 className="text-lg font-semibold">Nothing to show yet</h1><p className="mt-2 text-sm text-muted">Add folders and run a scan to fill your library.</p><div className="mt-5 flex justify-center gap-3"><Link to="/library" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Open library</Link><Link to="/settings" className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised">Settings</Link></div></section>;
  return <div className={`space-y-8 ${restoreScrollY === undefined ? 'animate-fade-in' : ''}`}>{rows.map((row) => <HomeRowSection key={row.key} row={row} />)}</div>;
}
