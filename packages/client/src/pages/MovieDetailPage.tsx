import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatRuntime, type ManualMatchCandidate } from '@ottlib/shared';
import { MatchCandidateRow } from '../components/MatchCandidateRow';
import { MovieActionButtons } from '../components/MovieActionButtons';
import { MediaInfoPanel } from '../components/MediaInfoPanel';
import { useMatchCandidates, useMovie, useMovieActions, useMovieDuplicates } from '../hooks/useMovies';
import { MovieShelfDialog } from '../components/MovieShelfDialog';
import { useShelfActions, useShelves } from '../hooks/useShelves';
import { useBackToLibrary, useBackToLibraryLabel } from '../hooks/useBackToLibrary';
import { NoArtworkCard } from '../components/NoArtworkCard';
import { ErrorState } from '../components/ErrorState';
import { MetadataRefreshDialog } from '../components/MetadataRefreshDialog';
import { useMetadataRefresh } from '../hooks/useMetadataRefresh';
import { SkeletonDetail } from '../components/Skeleton';
import { PosterImage } from '../components/PosterImage';
import { DuplicateCompareDialog } from '../components/DuplicateCompareDialog';

function BrowseFilterChips({ label, values, parameter }: { label: string; values: string[]; parameter: 'genre' | 'actor' }) {
  return <div><h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</h2><div className="mt-2 flex flex-wrap gap-2">{values.length ? values.map((value) => <Link key={value} to={`/?${parameter}=${encodeURIComponent(value)}`} className="rounded-full border border-accent-soft-border bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-foreground hover:bg-accent-soft/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={`Browse ${parameter} ${value}`}>{value}</Link>) : <span className="text-sm text-muted">—</span>}</div></div>;
}

export function MovieDetailPage() {
  const { id } = useParams();
  const movie = useMovie(id);
  const duplicates = useMovieDuplicates(id);
  const actions = useMovieActions();
  const [override, setOverride] = useState<string>();
  const [manualCandidates, setManualCandidates] = useState<ManualMatchCandidate[] | null>(null);
  const [imdbInput, setImdbInput] = useState('');
  const [shelfManagerOpen, setShelfManagerOpen] = useState(false);
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const backdrop = useRef<HTMLImageElement>(null);
  const shelves = useShelves(); const shelfActions = useShelfActions();
  const metadataRefresh = useMetadataRefresh();
  const backToLibrary = useBackToLibrary();
  const backToLibraryLabel = useBackToLibraryLabel();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setManualCandidates(null);
  }, [id]);
  useEffect(() => {
    if (!movie.data?.backdropUrl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (backdrop.current) backdrop.current.style.transform = `translate3d(0, ${Math.min(window.scrollY * 0.08, 24)}px, 0) scale(1.03)`;
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (frame) window.cancelAnimationFrame(frame); };
  }, [movie.data?.backdropUrl]);
  const needsReview = movie.data?.metadataStatus === 'suggested';
  const candidates = useMatchCandidates(id, needsReview && manualCandidates === null);

  if (movie.isLoading) return <SkeletonDetail />;
  if (!movie.data) return <ErrorState resource="title" error={movie.error} retrying={movie.isFetching} onRetry={movie.refetch} />;

  const item = movie.data;
  const activeTitle = override ?? item.title;
  const runtime = formatRuntime(item.runtime, item.mediaInfo?.durationMs);
  const imdbUrl = item.imdbId ? `https://www.imdb.com/title/${item.imdbId}/` : `https://www.imdb.com/find/?q=${encodeURIComponent(`${item.title}${item.year ? ` ${item.year}` : ''}`)}&s=tt`;
  return <section className="space-y-6">
    <button type="button" onClick={backToLibrary} className="text-sm text-accent hover:underline">← {backToLibraryLabel}</button>
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      {item.backdropUrl && <div className="h-56 overflow-hidden md:h-80"><img ref={backdrop} src={item.backdropUrl} alt="" className="h-full w-full object-cover opacity-60" /></div>}
      <div className="grid gap-6 p-5 md:grid-cols-[220px_minmax(0,1fr)] md:p-8 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface-raised">
          {item.posterUrl ? <PosterImage src={item.posterUrl} alt={`${item.title} poster`} loading="lazy" decoding="async" className="h-full w-full object-cover" style={{ viewTransitionName: 'poster' }} /> : <NoArtworkCard title={item.title} year={item.year} status={item.metadataStatus} />}
        </div>
        <div className="space-y-5">
          <div><h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">
            <span>{item.title} {item.year && <span className="text-muted">({item.year})</span>}</span>
            <a href={`https://www.google.com/search?q=${encodeURIComponent(`${item.title}${item.year ? ` ${item.year}` : ''}`)}`} target="_blank" rel="noopener noreferrer" title="Search Google for this title" className="text-subtle hover:text-accent" aria-label="Search Google for this title">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            </a>
          </h1><p className="mt-2 text-sm text-muted">{[runtime, item.rating ? `★ ${item.rating.toFixed(1)}` : null, item.metadataSource ?? 'Unmatched'].filter(Boolean).join(' · ')}</p>{duplicates.data?.length ? <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted"><span>{duplicates.data.length} other cop{duplicates.data.length === 1 ? 'y' : 'ies'} in your library</span><button type="button" onClick={() => setCompareOpen(true)} className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-raised">Compare</button></div> : null}</div>
          <MovieActionButtons imdbUrl={imdbUrl} movie={item} onManageShelves={() => setShelfManagerOpen(true)} onToggleWatched={() => actions.watch.mutate({ id: item.id, watched: !item.watched })} watchPending={actions.watch.isPending} />
          {item.overview && <p className="max-w-3xl leading-7 text-foreground/90">{item.overview}</p>}
          <div className="grid gap-5 sm:grid-cols-2"><BrowseFilterChips label="Genres" values={item.genres} parameter="genre" /><BrowseFilterChips label="Cast" values={item.cast} parameter="actor" /></div>
        </div>
        <MediaInfoPanel mediaInfo={item.mediaInfo} filePath={item.filePath} />
      </div>
    </div>
    <form onSubmit={(event) => { event.preventDefault(); actions.titleOverride.mutate({ id: item.id, titleOverride: activeTitle.trim() || null }); }} className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Fix this match</h2>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input value={activeTitle} onChange={(event) => { setOverride(event.target.value); setManualCandidates(null); }} className="flex-1 rounded-lg border border-border bg-field px-3 py-2" />
        <button disabled={actions.titleOverride.isPending} className="rounded-lg border border-border-strong px-4 py-2 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{actions.titleOverride.isPending ? 'Saving…' : 'Save title'}</button>
        <button type="button" onClick={() => actions.rematch.mutate({ id: item.id, title: activeTitle }, { onSuccess: setManualCandidates })} disabled={actions.rematch.isPending} className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{actions.rematch.isPending ? 'Searching…' : 'Find matches'}</button>
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input value={imdbInput} onChange={(event) => setImdbInput(event.target.value)} placeholder="Paste an IMDb URL or ID (e.g. tt1375666)" className="flex-1 rounded-lg border border-border bg-field px-3 py-2 placeholder:text-subtle" />
        <button type="button" onClick={() => actions.lookupImdb.mutate({ id: item.id, imdbId: imdbInput }, { onSuccess: () => setManualCandidates(null) })} disabled={actions.lookupImdb.isPending || !imdbInput.trim()} className="rounded-lg border border-border-strong px-4 py-2 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{actions.lookupImdb.isPending ? 'Looking up…' : 'Fetch from IMDb'}</button>
      </div>
      <div className="mt-4 border-t border-border pt-4"><p className="text-sm text-muted">Refreshes this title's automatic metadata and artwork. Your saved title override is kept.</p><button type="button" onClick={() => setRefreshDialogOpen(true)} disabled={metadataRefresh.status.data?.status === 'running'} className="mt-3 rounded-lg border border-warning-border px-4 py-2 text-sm font-medium text-warning hover:bg-warning-border/15 disabled:cursor-not-allowed disabled:opacity-60">Refresh metadata</button></div>
    </form>
    {(needsReview || manualCandidates !== null) && <div className="rounded-xl border border-warning-border/50 bg-surface p-5">
      <h2 className="font-semibold text-warning">{manualCandidates !== null ? 'Match results — pick one' : 'Suggested matches — pick one'}</h2>
      <p className="mt-1 text-sm text-muted">Accept a suggestion to replace this title's metadata and artwork. Fields the provider doesn't have will stay blank.</p>
      {manualCandidates === null && candidates.isLoading && <p className="mt-3 text-sm text-muted">Loading suggestions…</p>}
      {manualCandidates !== null && manualCandidates.length === 0 && <p className="mt-3 text-sm text-muted">No candidates found. Try adjusting the title above and searching again.</p>}
      {manualCandidates === null && candidates.data && candidates.data.length === 0 && <p className="mt-3 text-sm text-muted">No candidates found. Try adjusting the title above and searching again.</p>}
      <ul className="mt-3 space-y-2">
        {manualCandidates?.map((candidate) => <MatchCandidateRow key={`${candidate.provider}-${candidate.providerId}-${candidate.mediaType}`} candidate={candidate} rawFilename={item.rawFilename} pending={actions.acceptManualCandidate.isPending}
          onAccept={(season, episode) => actions.acceptManualCandidate.mutate({ id: item.id, candidate, season, episode }, { onSuccess: () => setManualCandidates(null) })} />)}
        {manualCandidates === null && candidates.data?.map((candidate) => <MatchCandidateRow key={candidate.id} candidate={candidate} rawFilename={item.rawFilename} pending={actions.acceptCandidate.isPending}
          onAccept={(season, episode) => actions.acceptCandidate.mutate({ id: item.id, candidateId: candidate.id, season, episode })} />)}
      </ul>
      {manualCandidates === null && candidates.data && candidates.data.length > 0 && <button type="button" onClick={() => actions.rejectCandidates.mutate(item.id)} disabled={actions.rejectCandidates.isPending} className="mt-3 text-sm text-muted hover:text-foreground hover:underline">None of these</button>}
    </div>}
    <MovieShelfDialog open={shelfManagerOpen} movie={item} shelves={shelves.data ?? []} saving={shelfActions.updateMovieShelves.isPending} onClose={() => setShelfManagerOpen(false)} onSave={({ shelfIds, newShelfName }) => shelfActions.updateMovieShelves.mutate({ movieId: item.id, shelfIds, newShelfName }, { onSuccess: () => setShelfManagerOpen(false) })} />
    <MetadataRefreshDialog open={refreshDialogOpen} title="Refresh title metadata" count={1} running={metadataRefresh.start.isPending} onClose={() => setRefreshDialogOpen(false)} onConfirm={() => metadataRefresh.start.mutate([item.id], { onSuccess: () => setRefreshDialogOpen(false) })} />
    <DuplicateCompareDialog open={compareOpen} onClose={() => setCompareOpen(false)} primary={item} duplicates={duplicates.data ?? []} />
  </section>;
}
