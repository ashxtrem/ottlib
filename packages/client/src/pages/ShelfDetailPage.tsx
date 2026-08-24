import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '../components/ErrorState';
import { LibraryFilters, countActiveFilters } from '../components/LibraryFilters';
import { LibraryOverview } from '../components/LibraryOverview';
import { MetadataRefreshDialog } from '../components/MetadataRefreshDialog';
import { PosterGrid } from '../components/PosterGrid';
import { ShelfMovieGrid } from '../components/ShelfMovieGrid';
import { ShelfNameDialog } from '../components/ShelfNameDialog';
import { ShelfSelectionDialog } from '../components/ShelfSelectionDialog';
import { useMetadataRefresh } from '../hooks/useMetadataRefresh';
import { useShelf, useShelfActions } from '../hooks/useShelves';
import { filterShelfMovies, initialShelfMovieFilters, shelfMovieFilterOptions, toShelfPosterItems, type ShelfMovieFilters } from '../utils/shelfMovieFilters';
import { SkeletonPosterGrid } from '../components/Skeleton';

export function ShelfDetailPage() {
  const { id } = useParams(); const { state: locationState } = useLocation(); const shelf = useShelf(id); const actions = useShelfActions(); const metadataRefresh = useMetadataRefresh(); const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false); const [renameOpen, setRenameOpen] = useState(false); const [refreshDialogOpen, setRefreshDialogOpen] = useState(false); const [organizing, setOrganizing] = useState(false); const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set()); const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null); const [filters, setFilters] = useState<ShelfMovieFilters>(initialShelfMovieFilters);
  const movies = shelf.data?.movies ?? [];
  const options = useMemo(() => shelfMovieFilterOptions(movies), [movies]);
  const filteredMovies = useMemo(() => filterShelfMovies(movies, filters), [filters, movies]);
  const posterMovies = useMemo(() => toShelfPosterItems(filteredMovies), [filteredMovies]);
  const filtersActive = countActiveFilters(filters) > 0;
  const movieIds = movies.map((movie) => movie.id).join(',');
  const restoredScroll = useRef(false);
  const restoreShelfScrollY = typeof locationState === 'object' && locationState !== null && 'restoreShelfScrollY' in locationState && typeof locationState.restoreShelfScrollY === 'number' ? locationState.restoreShelfScrollY : undefined;
  useEffect(() => { setToolbarTarget(document.getElementById('library-toolbar')); }, []);
  useEffect(() => { setSelectedIds((current) => { const next = new Set([...current].filter((movieId) => movies.some((movie) => movie.id === movieId))); return next.size === current.size ? current : next; }); }, [movieIds, movies]);
  useLayoutEffect(() => {
    if (!shelf.isSuccess || restoredScroll.current || restoreShelfScrollY === undefined) return;
    restoredScroll.current = true;
    const restore = () => window.scrollTo({ top: restoreShelfScrollY, behavior: 'auto' });
    restore();
    const frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
  }, [restoreShelfScrollY, shelf.isSuccess]);

  if (shelf.isLoading) return <SkeletonPosterGrid />;
  if (!shelf.data) return <ErrorState resource="shelf" error={shelf.error} retrying={shelf.isFetching} onRetry={shelf.refetch} />;

  const item = shelf.data;
  const updateFilters = (change: Partial<ShelfMovieFilters>) => setFilters((current) => ({ ...current, ...change }));
  const clearFilters = () => setFilters({ ...initialShelfMovieFilters });
  const deleteShelf = () => { if (window.confirm(`Delete “${item.name}”? This will not delete any movie files.`)) actions.removeShelf.mutate(item.id, { onSuccess: () => navigate('/shelves') }); };
  const toggleOrganizer = () => { setSelectedIds(new Set()); setOrganizing((current) => !current); };
  const toolbar = <div className="min-w-0"><LibraryFilters values={filters} options={options} onSearchChange={(search) => updateFilters({ search })} onAvailabilityChange={(availability) => updateFilters({ availability })} onGenreChange={(genre) => updateFilters({ genre })} onActorChange={(actor) => updateFilters({ actor })} onQualityChange={(quality) => updateFilters({ quality })} onAudioLanguageChange={(audioLanguage) => updateFilters({ audioLanguage })} onMinRatingChange={(minRating) => updateFilters({ minRating })} onWatchedChange={(watched) => updateFilters({ watched })} onSortChange={(sort) => updateFilters({ sort })} onNeedsReviewChange={(needsReview) => updateFilters({ needsReview })} onClearFilters={clearFilters} idPrefix={`shelf-${item.id}`} searchLabel={`Search ${item.name} shelf`} searchPlaceholder={`Search ${item.name}`} trailingContent={<LibraryOverview titleCount={item.movieCount} unavailableCount={item.movies.filter((movie) => movie.missing).length} matchingTitleCount={filtersActive ? filteredMovies.length : undefined} acceptedMatchCount={undefined} className="mb-0" />} /></div>;

  return <section className="space-y-6">
    {!organizing && toolbarTarget && createPortal(toolbar, toolbarTarget)}
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div><Link to="/shelves" className="text-sm text-accent hover:underline">← Back to shelves</Link><h1 className="mt-2 text-2xl font-bold">{item.name}</h1><p className="mt-1 text-sm text-muted">{organizing ? 'Drag titles to set the watch order.' : 'Browse, filter, select, and refresh titles in this collection.'}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={toggleOrganizer} className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised">{organizing ? 'Browse shelf' : 'Organize shelf'}</button><button type="button" onClick={() => setAddOpen(true)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Add titles</button><button type="button" onClick={() => setRenameOpen(true)} className="rounded-lg border border-border-strong px-4 py-2 text-sm hover:bg-surface-raised">Rename</button><button type="button" onClick={deleteShelf} disabled={actions.removeShelf.isPending} className="rounded-lg border border-error-border px-4 py-2 text-sm text-error hover:bg-error-soft/40 disabled:cursor-not-allowed disabled:opacity-60">Delete</button></div>
    </div>
    {selectedIds.size > 0 && !organizing && <div className="fixed bottom-5 left-4 right-24 z-20 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 text-sm shadow-lg"><span>{selectedIds.size} {selectedIds.size === 1 ? 'title' : 'titles'} selected</span><div className="flex items-center gap-3"><button type="button" onClick={() => setRefreshDialogOpen(true)} disabled={metadataRefresh.status.data?.status === 'running'} className="font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50">Refresh metadata</button><button type="button" onClick={() => setSelectedIds(new Set())} className="text-muted hover:text-foreground hover:underline">Clear selection</button></div></div>}
    {!item.movies.length ? <div className="rounded-xl border border-dashed border-border p-12 text-center"><h2 className="text-lg font-semibold">This shelf is empty</h2><p className="mt-2 text-sm text-muted">Add titles whenever you are ready.</p><button type="button" onClick={() => setAddOpen(true)} className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Add titles</button></div>
      : organizing ? <ShelfMovieGrid shelfId={item.id} movies={item.movies} busy={actions.removeMovie.isPending || actions.reorder.isPending} onRemove={(movieId) => actions.removeMovie.mutate({ id: item.id, movieId })} onReorder={(movieIds) => actions.reorder.mutate({ id: item.id, movieIds })} />
        : posterMovies.length ? <PosterGrid movies={posterMovies} shelfId={item.id} selectedIds={selectedIds} onSelectionChange={setSelectedIds} animateInitial={restoreShelfScrollY === undefined} />
          : <div className="rounded-xl border border-dashed border-border p-12 text-center"><h2 className="text-lg font-semibold">No titles match these filters</h2><p className="mt-2 text-sm text-muted">Try broadening your search or clearing the active filters.</p><button type="button" onClick={clearFilters} className="mt-4 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised">Clear filters</button></div>}
    <ShelfSelectionDialog open={addOpen} title={`Add titles to ${item.name}`} confirmLabel="Add titles" saving={actions.addMovies.isPending} onClose={() => setAddOpen(false)} onSave={({ movieIds }) => actions.addMovies.mutate({ id: item.id, movieIds }, { onSuccess: () => setAddOpen(false) })} />
    <ShelfNameDialog open={renameOpen} name={item.name} saving={actions.rename.isPending} onClose={() => setRenameOpen(false)} onSave={(name) => actions.rename.mutate({ id: item.id, name }, { onSuccess: () => setRenameOpen(false) })} />
    <MetadataRefreshDialog open={refreshDialogOpen} title="Refresh selected metadata" count={selectedIds.size} running={metadataRefresh.start.isPending} onClose={() => setRefreshDialogOpen(false)} onConfirm={() => metadataRefresh.start.mutate([...selectedIds], { onSuccess: () => { setRefreshDialogOpen(false); setSelectedIds(new Set()); } })} />
  </section>;
}
