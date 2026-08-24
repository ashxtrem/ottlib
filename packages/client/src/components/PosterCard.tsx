import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { MovieListItem } from '@ottlib/shared';
import { saveLibraryScrollPosition } from '../hooks/useLibraryScrollRestoration';
import { NoArtworkCard } from './NoArtworkCard';
import { PosterImage } from './PosterImage';
import { focusRing, liftable, pressable } from './interactionStyles';

function cardTitleSize(title: string): string {
  return title.length > 24 ? 'text-sm leading-5' : 'text-base leading-5';
}

export function PosterCard({ movie, onReview, onToggleWatched, selected = false, onSelectedChange, shelfId }: { movie: MovieListItem; onReview?: () => void; onToggleWatched: () => void; selected?: boolean; onSelectedChange?: (selected: boolean) => void; shelfId?: number }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const firstShelf = movie.shelves[0];
  const openMovie = (event: MouseEvent<HTMLAnchorElement>) => {
    if (shelfId !== undefined) {
      if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault(); event.currentTarget.querySelector('img')?.style.setProperty('view-transition-name', 'poster'); navigate(`/movie/${movie.id}`, { state: { fromShelf: true, shelfId, shelfScrollY: window.scrollY }, viewTransition: true }); window.setTimeout(() => event.currentTarget.querySelector('img')?.style.removeProperty('view-transition-name'), 500); return;
    }
    saveLibraryScrollPosition();
    if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    event.currentTarget.querySelector('img')?.style.setProperty('view-transition-name', 'poster');
    navigate(`/movie/${movie.id}`, { state: { fromLibrary: true, libraryScrollY: window.scrollY, librarySearch: search }, viewTransition: true });
    window.setTimeout(() => event.currentTarget.querySelector('img')?.style.removeProperty('view-transition-name'), 500);
  };
  const needsReview = movie.metadataStatus === 'suggested';
  const qualityMarkers = [movie.resolution === '4K' ? '4K' : null, movie.hdrFormat ? 'HDR' : null].filter((value): value is string => value !== null);
  const movieLinkState = shelfId === undefined ? undefined : { fromShelf: true, shelfId };
  return <article className={`group relative flex h-full flex-col overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-border ${liftable} hover:shadow-xl hover:ring-accent focus-within:-translate-y-1 focus-within:shadow-xl focus-within:ring-accent`}>
    <Link to={`/movie/${movie.id}`} viewTransition state={movieLinkState} onClick={openMovie} className={`block ${focusRing}`}><div className={`relative aspect-[2/3] overflow-hidden bg-surface-raised transition-opacity duration-base ease-standard ${movie.watched ? 'opacity-70' : 'opacity-100'}`}>{movie.posterUrl ? <PosterImage src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-slow ease-standard group-hover:scale-[1.03] group-focus-within:scale-[1.03]" /> : <NoArtworkCard title={movie.title} year={movie.year} status={movie.metadataStatus} />}{qualityMarkers.length > 0 && <div className="absolute bottom-2 left-2 flex gap-1" aria-label={qualityMarkers.join(', ')}>{qualityMarkers.map((marker) => <span key={marker} title={marker === 'HDR' ? movie.hdrFormat ?? undefined : undefined} className="rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow">{marker}</span>)}</div>}</div></Link>
    <div className="relative flex flex-1 flex-col p-3 pb-11"><Link to={`/movie/${movie.id}`} state={movieLinkState} onClick={openMovie} className={`block min-h-10 line-clamp-2 break-words font-medium text-foreground hover:text-accent ${cardTitleSize(movie.title)} ${focusRing}`}>{movie.title}</Link><div className="mt-1 text-xs text-muted"><span>{movie.year ?? '—'}</span></div>
      {needsReview && onReview && <button type="button" onClick={onReview} className="mt-3 w-full rounded-lg border border-warning-border/70 px-2 py-1.5 text-xs font-semibold text-warning hover:bg-warning-border/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-border">Review match</button>}
      {onSelectedChange && <label className="absolute bottom-3 left-3 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border bg-field/40 text-muted transition-[background-color,color] duration-fast hover:bg-surface-raised hover:text-foreground"><input type="checkbox" checked={selected} onChange={(event) => onSelectedChange(event.target.checked)} aria-label={`Select ${movie.title}`} className={`h-3.5 w-3.5 accent-accent ${focusRing}`} /></label>}
      <button type="button" onClick={onToggleWatched} aria-pressed={movie.watched} aria-label={movie.watched ? `Mark ${movie.title} as unwatched` : `Mark ${movie.title} as watched`} title={movie.watched ? 'Mark as unwatched' : 'Mark as watched'} className={`absolute bottom-3 right-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-field/40 text-muted transition-[background-color,transform,color] duration-fast ease-emphasis hover:bg-surface-raised hover:text-foreground ${pressable} ${focusRing} ${movie.watched ? 'animate-pop-in text-success-foreground' : ''}`}><svg key={String(movie.watched)} aria-hidden="true" className={`h-3.5 w-3.5 ${movie.watched ? '[stroke-dasharray:24] animate-draw-check' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{movie.watched ? <path pathLength="24" d="m7.5 12 3 3 6-6" /> : <circle cx="12" cy="12" r="8.5" />}</svg><span className="sr-only">{movie.watched ? 'Watched' : 'Not watched'}</span></button>
    </div>
    {firstShelf && <Link to={`/shelves/${firstShelf.id}`} onClick={(event) => event.stopPropagation()} className="absolute left-2 top-2 z-10 max-w-[calc(100%-3.25rem)] truncate rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground shadow"><span>{firstShelf.name}</span>{movie.shelves.length > 1 && <span> +{movie.shelves.length - 1}</span>}</Link>}
    {movie.missing && <span className="absolute right-2 top-12 rounded-full bg-error px-2 py-0.5 text-xs font-medium text-error-solid-foreground">Unavailable</span>}
    {needsReview && movie.posterUrl && <span className={`absolute right-2 ${movie.missing ? 'top-20' : 'top-12'} z-10 rounded-full bg-warning-border px-2 py-0.5 text-xs font-medium text-warning-foreground`}>Needs review</span>}
  </article>;
}
