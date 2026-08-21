import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MatchCandidateRow } from '../components/MatchCandidateRow';
import { PlayButton } from '../components/PlayButton';
import { MediaInfoPanel } from '../components/MediaInfoPanel';
import { useMatchCandidates, useMovie, useMovieActions } from '../hooks/useMovies';
import { MovieShelfDialog } from '../components/MovieShelfDialog';
import { useShelfActions, useShelves } from '../hooks/useShelves';

export function MovieDetailPage() {
  const { id } = useParams();
  const movie = useMovie(id);
  const actions = useMovieActions();
  const [override, setOverride] = useState<string>();
  const [imdbInput, setImdbInput] = useState('');
  const [shelfManagerOpen, setShelfManagerOpen] = useState(false);
  const shelves = useShelves(); const shelfActions = useShelfActions();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [id]);
  const needsReview = movie.data?.metadataStatus === 'suggested';
  const candidates = useMatchCandidates(id, needsReview);

  if (movie.isLoading) return <p className="text-muted">Loading movie…</p>;
  if (!movie.data) return <p className="text-error">Movie not found.</p>;

  const item = movie.data;
  const activeTitle = override ?? item.title;
  const imdbUrl = item.imdbId ? `https://www.imdb.com/title/${item.imdbId}/` : `https://www.imdb.com/find/?q=${encodeURIComponent(`${item.title}${item.year ? ` ${item.year}` : ''}`)}&s=tt`;
  return <section className="space-y-6">
    <Link to="/" className="text-sm text-accent hover:underline">← Back to library</Link>
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      {item.backdropUrl && <img src={item.backdropUrl} alt="" className="h-56 w-full object-cover opacity-60 md:h-80" />}
      <div className="grid gap-6 p-5 md:grid-cols-[220px_minmax(0,1fr)] md:p-8 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface-raised">
          {item.posterUrl ? <img src={item.posterUrl} alt={`${item.title} poster`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-subtle">No poster</div>}
        </div>
        <div className="space-y-5">
          <div><h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">
            <span>{item.title} {item.year && <span className="text-muted">({item.year})</span>}</span>
            <a href={`https://www.google.com/search?q=${encodeURIComponent(`${item.title}${item.year ? ` ${item.year}` : ''}`)}`} target="_blank" rel="noopener noreferrer" title="Search Google for this title" className="text-subtle hover:text-accent" aria-label="Search Google for this title">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            </a>
          </h1><p className="mt-2 text-sm text-muted">{item.runtime && `${item.runtime} min · `}{item.rating && `★ ${item.rating.toFixed(1)} · `}{item.metadataSource ?? 'Unmatched'}</p></div>
          <div className="flex flex-wrap items-center gap-2"><PlayButton movie={item} /><a href={imdbUrl} target="_blank" rel="noopener noreferrer" title="View on IMDb" aria-label="View on IMDb" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#f5c518]/70 text-[#f5c518] hover:bg-[#f5c518]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5c518]"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16v18H4V3Zm2 2v14h12V5H6Zm2 2h2v10H8V7Zm3.5 0H14v10h-2.5V7Zm4 0H16v10h-1.5V7Z" /></svg><span className="sr-only">View on IMDb</span></a><button type="button" onClick={() => setShelfManagerOpen(true)} title="Manage shelves" aria-label="Manage shelves" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-foreground hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z" /><path d="M8 9h8M8 13h5" /></svg><span className="sr-only">Manage shelves</span></button><button type="button" onClick={() => actions.watch.mutate({ id: item.id, watched: !item.watched })} disabled={actions.watch.isPending} title={item.watched ? 'Mark as unwatched' : 'Mark as watched'} aria-label={item.watched ? 'Mark as unwatched' : 'Mark as watched'} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-foreground hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60">{actions.watch.isPending ? <svg aria-hidden="true" className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12a8 8 0 1 1-2.34-5.66" /></svg> : item.watched ? <svg aria-hidden="true" className="h-5 w-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg> : <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.3 2.3 4.8-4.8" /></svg>}<span className="sr-only">{item.watched ? 'Mark as unwatched' : 'Mark as watched'}</span></button></div>
          {item.overview && <p className="max-w-3xl leading-7 text-foreground/90">{item.overview}</p>}
          <div className="grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-subtle">Genres:</span> {item.genres.join(', ') || '—'}</p><p><span className="text-subtle">Cast:</span> {item.cast.join(', ') || '—'}</p></div>
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
