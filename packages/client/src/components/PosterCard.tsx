import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { MovieListItem } from '@ottlib/shared';
import { saveLibraryScrollPosition } from '../hooks/useLibraryScrollRestoration';
import { NoArtworkCard } from './NoArtworkCard';

export function PosterCard({ movie, onReview, onToggleWatched }: { movie: MovieListItem; onReview?: () => void; onToggleWatched: () => void }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const firstShelf = movie.shelves[0];
  const openMovie = (event: MouseEvent<HTMLAnchorElement>) => {
    saveLibraryScrollPosition();
    if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    navigate(`/movie/${movie.id}`, { state: { fromLibrary: true, libraryScrollY: window.scrollY, librarySearch: search } });
  };
  const needsReview = movie.metadataStatus === 'suggested';
  const qualityMarkers = [movie.resolution === '4K' ? '4K' : null, movie.hdrFormat ? 'HDR' : null].filter((value): value is string => value !== null);
  return <article className="group relative overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-border transition hover:-translate-y-1 hover:ring-accent">
    <Link to={`/movie/${movie.id}`} onClick={openMovie} className="block"><div className={`relative aspect-[2/3] bg-surface-raised transition-opacity ${movie.watched ? 'opacity-70' : 'opacity-100'}`}>{movie.posterUrl ? <img src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <NoArtworkCard title={movie.title} year={movie.year} status={movie.metadataStatus} />}{qualityMarkers.length > 0 && <div className="absolute bottom-2 left-2 flex gap-1" aria-label={qualityMarkers.join(', ')}>{qualityMarkers.map((marker) => <span key={marker} title={marker === 'HDR' ? movie.hdrFormat ?? undefined : undefined} className="rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow">{marker}</span>)}</div>}</div></Link>
    <div className="p-3"><Link to={`/movie/${movie.id}`} onClick={openMovie} className="block truncate font-medium text-foreground hover:text-accent">{movie.title}</Link><div className="mt-1 text-xs text-muted"><span>{movie.year ?? '—'}</span></div>
      {needsReview && onReview && <button type="button" onClick={onReview} className="mt-3 w-full rounded-lg border border-warning-border/70 px-2 py-1.5 text-xs font-semibold text-warning hover:bg-warning-border/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-border">Review match</button>}
    </div>
    {firstShelf && <Link to={`/shelves/${firstShelf.id}`} onClick={(event) => event.stopPropagation()} className="absolute left-2 top-2 z-10 max-w-[75%] truncate rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground shadow"><span>{firstShelf.name}</span>{movie.shelves.length > 1 && <span> +{movie.shelves.length - 1}</span>}</Link>}
    {needsReview && movie.posterUrl && <span className="absolute right-2 top-12 z-10 rounded-full bg-warning-border px-2 py-0.5 text-xs font-medium text-warning-foreground">Needs review</span>}
    <button type="button" onClick={onToggleWatched} aria-pressed={movie.watched} aria-label={movie.watched ? `Mark ${movie.title} as unwatched` : `Mark ${movie.title} as watched`} title={movie.watched ? 'Mark as unwatched' : 'Mark as watched'} className={`absolute right-2 top-2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full shadow transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${movie.watched ? 'bg-success text-success-foreground' : 'bg-field/90 text-foreground hover:bg-field'}`}><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">{movie.watched ? <path d="m7.5 12 3 3 6-6" /> : <circle cx="12" cy="12" r="8.5" />}</svg><span className="sr-only">{movie.watched ? 'Watched' : 'Not watched'}</span></button>
  </article>;
}
