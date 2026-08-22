import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatRuntime } from '@ottlib/shared';
import { MatchCandidateRow } from '../components/MatchCandidateRow';
import { MovieActionButtons } from '../components/MovieActionButtons';
import { MediaInfoPanel } from '../components/MediaInfoPanel';
import { useMatchCandidates, useMovie, useMovieActions } from '../hooks/useMovies';
import { MovieShelfDialog } from '../components/MovieShelfDialog';
import { useShelfActions, useShelves } from '../hooks/useShelves';
import { useBackToLibrary } from '../hooks/useBackToLibrary';
import { NoArtworkCard } from '../components/NoArtworkCard';
import { ErrorState } from '../components/ErrorState';

function BrowseFilterChips({ label, values, parameter }: { label: string; values: string[]; parameter: 'genre' | 'actor' }) {
  return <div><h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</h2><div className="mt-2 flex flex-wrap gap-2">{values.length ? values.map((value) => <Link key={value} to={`/?${parameter}=${encodeURIComponent(value)}`} className="rounded-full border border-accent-soft-border bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-foreground hover:bg-accent-soft/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={`Browse ${parameter} ${value}`}>{value}</Link>) : <span className="text-sm text-muted">—</span>}</div></div>;
}

export function MovieDetailPage() {
  const { id } = useParams();
  const movie = useMovie(id);
  const actions = useMovieActions();
  const [override, setOverride] = useState<string>();
  const [imdbInput, setImdbInput] = useState('');
  const [shelfManagerOpen, setShelfManagerOpen] = useState(false);
  const shelves = useShelves(); const shelfActions = useShelfActions();
  const backToLibrary = useBackToLibrary();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [id]);
  const needsReview = movie.data?.metadataStatus === 'suggested';
  const candidates = useMatchCandidates(id, needsReview);

  if (movie.isLoading) return <p className="text-muted">Loading movie…</p>;
  if (!movie.data) return <ErrorState resource="title" error={movie.error} retrying={movie.isFetching} onRetry={movie.refetch} />;

  const item = movie.data;
  const activeTitle = override ?? item.title;
  const runtime = formatRuntime(item.runtime, item.mediaInfo?.durationMs);
  const imdbUrl = item.imdbId ? `https://www.imdb.com/title/${item.imdbId}/` : `https://www.imdb.com/find/?q=${encodeURIComponent(`${item.title}${item.year ? ` ${item.year}` : ''}`)}&s=tt`;
  return <section className="space-y-6">
    <button type="button" onClick={backToLibrary} className="text-sm text-accent hover:underline">← Back to library</button>
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      {item.backdropUrl && <img src={item.backdropUrl} alt="" className="h-56 w-full object-cover opacity-60 md:h-80" />}
      <div className="grid gap-6 p-5 md:grid-cols-[220px_minmax(0,1fr)] md:p-8 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface-raised">
          {item.posterUrl ? <img src={item.posterUrl} alt={`${item.title} poster`} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <NoArtworkCard title={item.title} year={item.year} status={item.metadataStatus} />}
        </div>
        <div className="space-y-5">
          <div><h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">
            <span>{item.title} {item.year && <span className="text-muted">({item.year})</span>}</span>
            <a href={`https://www.google.com/search?q=${encodeURIComponent(`${item.title}${item.year ? ` ${item.year}` : ''}`)}`} target="_blank" rel="noopener noreferrer" title="Search Google for this title" className="text-subtle hover:text-accent" aria-label="Search Google for this title">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            </a>
          </h1><p className="mt-2 text-sm text-muted">{[runtime, item.rating ? `★ ${item.rating.toFixed(1)}` : null, item.metadataSource ?? 'Unmatched'].filter(Boolean).join(' · ')}</p></div>
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
        <input value={activeTitle} onChange={(event) => setOverride(event.target.value)} className="flex-1 rounded-lg border border-border bg-field px-3 py-2" />
        <button disabled={actions.titleOverride.isPending} className="rounded-lg border border-border-strong px-4 py-2 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{actions.titleOverride.isPending ? 'Saving…' : 'Save title'}</button>
        <button type="button" onClick={() => actions.rematch.mutate({ id: item.id, title: activeTitle })} disabled={actions.rematch.isPending} className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{actions.rematch.isPending ? 'Searching…' : 'Find matches'}</button>
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input value={imdbInput} onChange={(event) => setImdbInput(event.target.value)} placeholder="Paste an IMDb URL or ID (e.g. tt1375666)" className="flex-1 rounded-lg border border-border bg-field px-3 py-2 placeholder:text-subtle" />
        <button type="button" onClick={() => actions.lookupImdb.mutate({ id: item.id, imdbId: imdbInput })} disabled={actions.lookupImdb.isPending || !imdbInput.trim()} className="rounded-lg border border-border-strong px-4 py-2 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60">{actions.lookupImdb.isPending ? 'Looking up…' : 'Fetch from IMDb'}</button>
      </div>
    </form>
    {needsReview && <div className="rounded-xl border border-warning-border/50 bg-surface p-5">
      <h2 className="font-semibold text-warning">Suggested matches — pick one</h2>
      <p className="mt-1 text-sm text-muted">Nothing is saved until you accept a suggestion. Fields the provider doesn't have will stay blank.</p>
      {candidates.isLoading && <p className="mt-3 text-sm text-muted">Loading suggestions…</p>}
      {candidates.data && candidates.data.length === 0 && <p className="mt-3 text-sm text-muted">No candidates found. Try adjusting the title above and searching again.</p>}
      <ul className="mt-3 space-y-2">
        {candidates.data?.map((candidate) => <MatchCandidateRow key={candidate.id} candidate={candidate} rawFilename={item.rawFilename} pending={actions.acceptCandidate.isPending}
          onAccept={(season, episode) => actions.acceptCandidate.mutate({ id: item.id, candidateId: candidate.id, season, episode })} />)}
      </ul>
      {candidates.data && candidates.data.length > 0 && <button type="button" onClick={() => actions.rejectCandidates.mutate(item.id)} disabled={actions.rejectCandidates.isPending} className="mt-3 text-sm text-muted hover:text-foreground hover:underline">None of these</button>}
    </div>}
    <MovieShelfDialog open={shelfManagerOpen} movie={item} shelves={shelves.data ?? []} saving={shelfActions.updateMovieShelves.isPending} onClose={() => setShelfManagerOpen(false)} onSave={({ shelfIds, newShelfName }) => shelfActions.updateMovieShelves.mutate({ movieId: item.id, shelfIds, newShelfName }, { onSuccess: () => setShelfManagerOpen(false) })} />
  </section>;
}
