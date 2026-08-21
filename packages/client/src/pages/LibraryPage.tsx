import { useEffect } from 'react';
import { PosterGrid } from '../components/PosterGrid';
import { useMovieFilterOptions, useMovies } from '../hooks/useMovies';
import { useScanStatus, useStartScan } from '../hooks/useScanStatus';
import { useToast } from '../hooks/useToast';
import { useLibraryScrollRestoration } from '../hooks/useLibraryScrollRestoration';
import { useLibraryViewState } from '../hooks/useLibraryViewState';

export function LibraryPage() {
  const { search, watched, sort, genre, actor, minRating, setSearch, setWatched, setSort, setGenre, setActor, setMinRating, clearFilters } = useLibraryViewState();
  const movies = useMovies({ search, watched, sort, genre, actor, minRating }); const filterOptions = useMovieFilterOptions(); const scan = useStartScan(); const scanStatus = useScanStatus(); const { show } = useToast(); const scanProgress = scanStatus.data?.status === 'running' ? scanStatus.data.filesProcessed : undefined;
  const startScan = () => {
    if (!window.confirm('Rescan your library? This may take a while, depending on the number of files.')) return;
    scan.mutate(undefined, { onSuccess: () => show('Library scan started.', 'success'), onError: (error) => show(error.message, 'error') });
  };
  useLibraryScrollRestoration(Boolean(movies.data));
  useEffect(() => { if (scanStatus.data?.status === 'running') void movies.refetch(); }, [scanStatus.data?.status, scanProgress]);
  const filtersActive = Boolean(search || genre || actor || minRating !== undefined || watched !== undefined || sort !== 'title');
  const titleCount = movies.data?.length;
  return <section>
    <div className="mb-6 rounded-xl border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or IMDb ID" aria-label="Search title or IMDb ID" className="rounded-lg border border-border bg-field px-4 py-2 outline-none ring-accent focus:ring" />
        <select value={genre} onChange={(event) => setGenre(event.target.value)} aria-label="Filter by genre" className="rounded-lg border border-border bg-field px-3 py-2"><option value="">All genres</option>{filterOptions.data?.genres.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <input value={actor} onChange={(event) => setActor(event.target.value)} list="movie-actors" placeholder="Actor" aria-label="Filter by actor" className="rounded-lg border border-border bg-field px-4 py-2 outline-none ring-accent focus:ring" />
        <datalist id="movie-actors">{filterOptions.data?.actors.map((value) => <option key={value} value={value} />)}</datalist>
        <select value={minRating ?? ''} onChange={(event) => setMinRating(event.target.value ? Number(event.target.value) : undefined)} aria-label="Minimum rating" className="rounded-lg border border-border bg-field px-3 py-2"><option value="">Any rating</option><option value="9">9.0+ rating</option><option value="8">8.0+ rating</option><option value="7">7.0+ rating</option><option value="6">6.0+ rating</option><option value="5">5.0+ rating</option></select>
        <select value={watched === undefined ? 'all' : String(watched)} onChange={(event) => setWatched(event.target.value === 'all' ? undefined : event.target.value === 'true')} aria-label="Watch status" className="rounded-lg border border-border bg-field px-3 py-2"><option value="all">All movies</option><option value="false">Unwatched</option><option value="true">Watched</option></select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort movies" className="rounded-lg border border-border bg-field px-3 py-2"><option value="title">Title</option><option value="year">Year</option><option value="added">Date added</option></select>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {titleCount !== undefined && <p aria-live="polite" className="text-sm text-muted">{titleCount} {titleCount === 1 ? 'title' : 'titles'}</p>}
        {search.trim() && <a href={`https://www.imdb.com/find/?q=${encodeURIComponent(search.trim())}&s=tt`} target="_blank" rel="noopener noreferrer" className="text-sm text-[#dcae00] hover:text-[#f5c518] hover:underline">Search IMDb</a>}
        {filtersActive && <button onClick={clearFilters} className="text-sm text-muted hover:text-accent hover:underline">Clear filters</button>}
        <button onClick={startScan} disabled={scan.isPending} className="rounded-lg bg-surface-raised px-4 py-2 text-sm font-medium hover:bg-border disabled:cursor-not-allowed disabled:opacity-60 sm:ml-auto">{scan.isPending ? 'Starting…' : 'Rescan now'}</button>
      </div>
    </div>
    {movies.isLoading && <p className="text-muted">Loading your library…</p>}{movies.error && <p className="text-error">{movies.error.message}</p>}{movies.data?.length === 0 && <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted">No movies match these filters.</div>}{movies.data && <PosterGrid movies={movies.data} />}
  </section>;
}
