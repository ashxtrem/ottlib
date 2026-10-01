import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { LibraryEmptyState } from '../components/LibraryEmptyState';
import { LibraryOverview } from '../components/LibraryOverview';
import { PosterGrid } from '../components/PosterGrid';
import { useAvailableSuggestedMovieCount, useLibraryTitleCount, useMovieFilterOptions, useMovies, useSuggestedMovieCount, useUnavailableMovieCount } from '../hooks/useMovies';
import { useScanHistory, useScanStatus, useStartScan } from '../hooks/useScanStatus';
import { useToast } from '../hooks/useToast';
import { useLibraryScrollRestoration } from '../hooks/useLibraryScrollRestoration';
import { useLibraryViewState } from '../hooks/useLibraryViewState';
import { getLibraryRestoreScrollPosition } from '../hooks/useBackToLibrary';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useScanMovieRefresh } from '../hooks/useScanMovieRefresh';
import { useAutoAcceptBackfill, useFolders, useSettings } from '../hooks/useSettings';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { LibraryFilters, countActiveFilters } from '../components/LibraryFilters';
import { ErrorState } from '../components/ErrorState';
import { MetadataRefreshDialog } from '../components/MetadataRefreshDialog';
import { useMetadataRefresh } from '../hooks/useMetadataRefresh';
import { SkeletonPosterGrid } from '../components/Skeleton';

export function LibraryPage() {
  const { state: locationState } = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);
  const { search, watched, availability, mediaType, sort, genre, actor, quality, audioLanguage, minRating, needsReview, setSearch, setWatched, setAvailability, setMediaType, setSort, setGenre, setActor, setQuality, setAudioLanguage, setMinRating, setNeedsReview, clearFilters, commitFilters } = useLibraryViewState();
  const debouncedSearch = useDebouncedValue(search);
  const querySearch = debouncedSearch;
  const movies = useMovies({ search: querySearch, watched, availability, mediaType, sort, genre, actor, quality, audioLanguage, minRating, needsReview }); const libraryTitleCount = useLibraryTitleCount(); const unavailableMovies = useUnavailableMovieCount(); const suggestedMovieCount = useSuggestedMovieCount(); const availableSuggestedMovieCount = useAvailableSuggestedMovieCount(); const autoAcceptBackfill = useAutoAcceptBackfill(); const metadataRefresh = useMetadataRefresh(); const filterOptions = useMovieFilterOptions(); const scan = useStartScan(); const scanStatus = useScanStatus(); const scanHistory = useScanHistory(); const folders = useFolders(); const settings = useSettings(); const { show } = useToast(); const loadMore = useRef<HTMLDivElement>(null);
  const startScan = () => scan.mutate(undefined, { onSuccess: () => { void scanHistory.refetch(); show('Library scan started.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const restoreScrollPosition = getLibraryRestoreScrollPosition(locationState);
  useLibraryScrollRestoration(movies.isSuccess, restoreScrollPosition);
  useScanMovieRefresh(scanStatus.data?.status, movies.refetch);
  useInfiniteScroll(loadMore, { enabled: Boolean(movies.hasNextPage), loading: movies.isFetchingNextPage, onLoadMore: () => { void movies.fetchNextPage(); } });
  useEffect(() => { if (scanStatus.data?.status !== 'running') { void scanHistory.refetch(); void libraryTitleCount.refetch(); void unavailableMovies.refetch(); } }, [libraryTitleCount.refetch, scanHistory.refetch, scanStatus.data?.status, unavailableMovies.refetch]);
  useEffect(() => { setToolbarTarget(document.getElementById('library-toolbar')); }, []);
  const filterValues = { search, availability, mediaType, genre, actor, quality, audioLanguage, minRating, watched, sort, needsReview };
  const filterSignature = JSON.stringify({ ...filterValues, search: querySearch });
  const filtersActive = countActiveFilters(filterValues) > 0;
  const hasRemainingReviews = (availableSuggestedMovieCount.data ?? 0) > 0;
  const acceptedMatchCount = autoAcceptBackfill.runStatus.data?.status === 'completed' && hasRemainingReviews ? autoAcceptBackfill.runStatus.data.titlesAdded : undefined;
  const matchingTitleCount = filtersActive ? movies.data?.total : undefined;
  const toolbar = <div className="min-w-0"><LibraryFilters values={filterValues} options={filterOptions.data} onSearchChange={setSearch} onAvailabilityChange={setAvailability} onMediaTypeChange={setMediaType} onGenreChange={setGenre} onActorChange={setActor} onQualityChange={setQuality} onAudioLanguageChange={setAudioLanguage} onMinRatingChange={setMinRating} onWatchedChange={setWatched} onSortChange={setSort} onNeedsReviewChange={setNeedsReview} onClearFilters={clearFilters} onCommitFilters={commitFilters} idPrefix="library" trailingContent={<LibraryOverview titleCount={libraryTitleCount.data} unavailableCount={unavailableMovies.data} matchingTitleCount={matchingTitleCount} acceptedMatchCount={acceptedMatchCount} className="mb-0" />} /></div>;
  return <section>
    {toolbarTarget && createPortal(toolbar, toolbarTarget)}
    {search.trim() && <div className="mb-6"><a href={`https://www.imdb.com/find/?q=${encodeURIComponent(search.trim())}&s=tt`} target="_blank" rel="noopener noreferrer" className="text-sm text-imdb hover:text-imdb-hover hover:underline">Search IMDb</a></div>}
    {(autoAcceptBackfill.status.data?.eligible ?? 0) > 0 && <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent-soft-border bg-accent-soft p-4 text-sm text-accent-soft-foreground">
      <p><span className="font-semibold">{autoAcceptBackfill.status.data?.eligible} of {suggestedMovieCount.data ?? '…'} unreviewed titles have a confident match.</span> Accept them now to fill in their details and artwork.</p>
      <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => autoAcceptBackfill.run.mutate()} disabled={autoAcceptBackfill.run.isPending || autoAcceptBackfill.runStatus.data?.status === 'running'} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{autoAcceptBackfill.run.isPending || autoAcceptBackfill.runStatus.data?.status === 'running' ? 'Accepting…' : 'Accept them all'}</button>{hasRemainingReviews && <Link to="/?needsReview=true" className="font-medium text-accent-soft-foreground underline underline-offset-2 hover:text-foreground">Review the rest</Link>}</div>
      {autoAcceptBackfill.run.error && <p className="w-full text-error">{autoAcceptBackfill.run.error.message}</p>}
    </div>}
    {autoAcceptBackfill.runStatus.data?.status === 'completed' && (autoAcceptBackfill.status.data?.eligible ?? 0) === 0 && hasRemainingReviews && <p className="mb-6 text-sm text-muted"><Link to="/?needsReview=true" className="text-accent hover:underline">Review remaining suggestions.</Link></p>}
    {selectedIds.size > 0 && <div className="fixed bottom-5 left-4 right-24 z-20 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 text-sm shadow-lg"><span>{selectedIds.size} {selectedIds.size === 1 ? 'title' : 'titles'} selected</span><div className="flex items-center gap-3"><button type="button" onClick={() => setRefreshDialogOpen(true)} disabled={metadataRefresh.status.data?.status === 'running'} className="font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50">Refresh metadata</button><button type="button" onClick={() => setSelectedIds(new Set())} className="text-muted hover:text-foreground hover:underline">Clear selection</button></div></div>}
    {movies.isLoading && <SkeletonPosterGrid />}{movies.error && !movies.data && <ErrorState resource="library" error={movies.error} retrying={movies.isFetching} onRetry={movies.refetch} />}{movies.isSuccess && movies.data?.items.length === 0 && <LibraryEmptyState folders={folders.data ?? []} scanHistory={scanHistory.data ?? []} tmdbConfigured={Boolean(settings.data?.tmdbApiKey)} torrentSearchEnabled={settings.data?.torrentSearchEnabled === true} filtersActive={filtersActive} scanning={scanStatus.data?.status === 'running' || scan.isPending} onStartScan={startScan} onClearFilters={clearFilters} />}{movies.data && movies.data.items.length > 0 && <div key={filterSignature} className={restoreScrollPosition === undefined ? 'animate-fade-in' : ''}><PosterGrid movies={movies.data.items} selectedIds={selectedIds} onSelectionChange={setSelectedIds} animateInitial={restoreScrollPosition === undefined} /></div>}{movies.hasNextPage && <div ref={loadMore} aria-live="polite" className="py-8">{movies.isFetchingNextPage ? <SkeletonPosterGrid count={4} /> : <p className="text-center text-sm text-muted">Scroll for more titles</p>}</div>}
    <MetadataRefreshDialog open={refreshDialogOpen} title="Refresh selected metadata" count={selectedIds.size} running={metadataRefresh.start.isPending} onClose={() => setRefreshDialogOpen(false)} onConfirm={() => metadataRefresh.start.mutate([...selectedIds], { onSuccess: () => { setRefreshDialogOpen(false); setSelectedIds(new Set()); } })} />
  </section>;
}
