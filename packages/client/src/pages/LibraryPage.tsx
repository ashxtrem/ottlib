import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LibraryEmptyState } from '../components/LibraryEmptyState';
import { PosterGrid } from '../components/PosterGrid';
import { useMovieFilterOptions, useMovies, useSuggestedMovieCount, useUnavailableMovieCount } from '../hooks/useMovies';
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

export function LibraryPage() {
  const { state: locationState } = useLocation();
  const { search, watched, availability, sort, genre, actor, quality, audioLanguage, minRating, needsReview, setSearch, setWatched, setAvailability, setSort, setGenre, setActor, setQuality, setAudioLanguage, setMinRating, setNeedsReview, clearFilters, commitFilters } = useLibraryViewState();
  const debouncedSearch = useDebouncedValue(search);
  const querySearch = debouncedSearch;
  const movies = useMovies({ search: querySearch, watched, availability, sort, genre, actor, quality, audioLanguage, minRating, needsReview }); const unavailableMovies = useUnavailableMovieCount(); const suggestedMovieCount = useSuggestedMovieCount(); const autoAcceptBackfill = useAutoAcceptBackfill(); const filterOptions = useMovieFilterOptions(); const scan = useStartScan(); const scanStatus = useScanStatus(); const scanHistory = useScanHistory(); const folders = useFolders(); const settings = useSettings(); const { show } = useToast(); const loadMore = useRef<HTMLDivElement>(null);
  const startScan = () => {
    if (scanHistory.data?.length && !window.confirm('Rescan your library? This may take a while, depending on the number of files.')) return;
    scan.mutate(undefined, { onSuccess: () => { void scanHistory.refetch(); show('Library scan started.', 'success'); }, onError: (error) => show(error.message, 'error') });
  };
  useLibraryScrollRestoration(movies.isSuccess, getLibraryRestoreScrollPosition(locationState));
  useScanMovieRefresh(scanStatus.data?.status, movies.refetch);
  useInfiniteScroll(loadMore, { enabled: Boolean(movies.hasNextPage), loading: movies.isFetchingNextPage, onLoadMore: () => { void movies.fetchNextPage(); } });
  useEffect(() => { if (scanStatus.data?.status !== 'running') { void scanHistory.refetch(); void unavailableMovies.refetch(); } }, [scanHistory.refetch, scanStatus.data?.status, unavailableMovies.refetch]);
  const filterValues = { search, availability, genre, actor, quality, audioLanguage, minRating, watched, sort, needsReview };
  const filtersActive = countActiveFilters(filterValues) > 0;
  const titleCount = movies.data?.total;
  return <section>
    <div className="mb-6 rounded-xl border border-border bg-surface p-4">
      <LibraryFilters values={filterValues} options={filterOptions.data} onSearchChange={setSearch} onAvailabilityChange={setAvailability} onGenreChange={setGenre} onActorChange={setActor} onQualityChange={setQuality} onAudioLanguageChange={setAudioLanguage} onMinRatingChange={setMinRating} onWatchedChange={setWatched} onSortChange={setSort} onNeedsReviewChange={setNeedsReview} onClearFilters={clearFilters} onCommitFilters={commitFilters} idPrefix="library" entityName="movies" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {titleCount !== undefined && <p aria-live="polite" className="text-sm text-muted">{titleCount} {titleCount === 1 ? 'title' : 'titles'}</p>}
        {(unavailableMovies.data ?? 0) > 0 && <p className="text-sm text-warning">{unavailableMovies.data} {unavailableMovies.data === 1 ? 'title is' : 'titles are'} unavailable — their {unavailableMovies.data === 1 ? 'file wasn\'t' : 'files weren\'t'} found.</p>}
        {search.trim() && <a href={`https://www.imdb.com/find/?q=${encodeURIComponent(search.trim())}&s=tt`} target="_blank" rel="noopener noreferrer" className="text-sm text-imdb hover:text-imdb-hover hover:underline">Search IMDb</a>}
      </div>
    </div>
    {(autoAcceptBackfill.status.data?.eligible ?? 0) > 0 && <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent-soft-border bg-accent-soft p-4 text-sm text-accent-soft-foreground">
      <p><span className="font-semibold">{autoAcceptBackfill.status.data?.eligible} of {suggestedMovieCount.data ?? '…'} unreviewed titles have a confident match.</span> Accept them now to fill in their details and artwork.</p>
      <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => autoAcceptBackfill.run.mutate()} disabled={autoAcceptBackfill.run.isPending || autoAcceptBackfill.runStatus.data?.status === 'running'} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{autoAcceptBackfill.run.isPending || autoAcceptBackfill.runStatus.data?.status === 'running' ? 'Accepting…' : 'Accept them all'}</button><Link to="/?needsReview=true" className="font-medium text-accent-soft-foreground underline underline-offset-2 hover:text-foreground">Review the rest</Link></div>
      {autoAcceptBackfill.run.error && <p className="w-full text-error">{autoAcceptBackfill.run.error.message}</p>}
    </div>}
    {autoAcceptBackfill.runStatus.data?.status === 'completed' && (autoAcceptBackfill.status.data?.eligible ?? 0) === 0 && <p className="mb-6 text-sm text-muted">Accepted {autoAcceptBackfill.runStatus.data.titlesAdded} confident matches. <Link to="/?needsReview=true" className="text-accent hover:underline">Review remaining suggestions.</Link></p>}
    {movies.isLoading && <p className="text-muted">Loading your library…</p>}{movies.error && !movies.data && <ErrorState resource="library" error={movies.error} retrying={movies.isFetching} onRetry={movies.refetch} />}{movies.isSuccess && movies.data?.items.length === 0 && <LibraryEmptyState folders={folders.data ?? []} scanHistory={scanHistory.data ?? []} tmdbConfigured={Boolean(settings.data?.tmdbApiKey)} filtersActive={filtersActive} scanning={scanStatus.data?.status === 'running' || scan.isPending} onStartScan={startScan} onClearFilters={clearFilters} />}{movies.data && movies.data.items.length > 0 && <div className={`transition-opacity duration-200 ${movies.isFetching ? 'opacity-60' : 'opacity-100'}`}><PosterGrid movies={movies.data.items} /></div>}{movies.hasNextPage && <div ref={loadMore} aria-live="polite" className="py-8 text-center text-sm text-muted">{movies.isFetchingNextPage ? 'Loading more titles…' : 'Scroll for more titles'}</div>}
  </section>;
}
