import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { formatRuntime, type MovieListItem } from '@ottlib/shared';
import type { HoverPreview } from '../hooks/useHoverPreview';
import { useMovie } from '../hooks/useMovies';
import type { OpenMovie } from '../hooks/useOpenMovie';
import { placePreview, type AnchorRect } from '../utils/hoverPlacement';
import { playLabel } from './PlayButton';
import { TrailerDialog } from './TrailerDialog';
import { focusRing, pressable } from './interactionStyles';

type PreviewProps = { movie: MovieListItem; preview: HoverPreview; open: OpenMovie; returnFocus: RefObject<HTMLElement | null>; onToggleWatched: () => void };

/** year · runtime · rating, skipping whatever is unknown. */
export function previewFacts(year: number | null, runtime: string | null, rating: number | null | undefined): string {
  return [year === null ? null : String(year), runtime, typeof rating === 'number' && rating > 0 ? `★ ${rating.toFixed(1)}` : null].filter(Boolean).join(' · ');
}

export function qualityChips(movie: Pick<MovieListItem, 'resolution' | 'hdrFormat'>): string[] {
  return [movie.resolution, movie.hdrFormat].filter((value): value is string => Boolean(value));
}

const secondaryButton = `inline-flex h-9 items-center justify-center rounded-lg border border-border-strong px-3 text-sm hover:bg-surface-raised ${pressable} ${focusRing}`;

type TrailerLayerProps = { trailerKey: string; title: string; open: boolean; onClose: () => void; container: Element };

/**
 * The trailer dialog, portalled to `container` (the body): rendered inline it would sit inside the row's `li`/`ul`,
 * where the roving tab stop, drag-scroll and arrow-key handlers of the row would reach into it.
 */
export function TrailerLayer({ container, ...dialog }: TrailerLayerProps) {
  return createPortal(<TrailerDialog {...dialog} />, container);
}

/** The pointer-only, enlarged card shown after a 400 ms rest on a poster, plus the trailer it can open. */
export function PosterHoverPreview({ movie, preview, open, returnFocus, onToggleWatched }: PreviewProps) {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const openTrailer = (key: string) => {
    // The preview (and its Trailer button) closes now; focus the card's title first so the dialog returns focus there on close.
    returnFocus.current?.focus({ preventScroll: true });
    setTrailerKey(key); setTrailerOpen(true); preview.close();
  };
  const body = typeof document === 'undefined' ? null : document.body;
  return <>
    {preview.anchor && body && createPortal(<PreviewPanel movie={movie} anchor={preview.anchor} handlers={preview.previewHandlers} open={open} onToggleWatched={onToggleWatched} onTrailer={openTrailer} />, body)}
    {trailerKey && body && <TrailerLayer trailerKey={trailerKey} title={movie.title} open={trailerOpen} onClose={() => setTrailerOpen(false)} container={body} />}
  </>;
}

/** The viewport without the classic scrollbar, so the 8 px edge clamp is measured from the visible content. */
function visibleViewport() {
  return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
}

type PanelProps = { movie: MovieListItem; anchor: AnchorRect; handlers: HoverPreview['previewHandlers']; open: OpenMovie; onToggleWatched: () => void; onTrailer: (key: string) => void };

function PreviewPanel({ movie, anchor, handlers, open, onToggleWatched, onTrailer }: PanelProps) {
  const details = useMovie(String(movie.id)).data;
  const panel = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const [entered, setEntered] = useState(false);
  useLayoutEffect(() => { if (panel.current) setHeight(panel.current.offsetHeight); }, [details]);
  useEffect(() => { const frame = window.requestAnimationFrame(() => setEntered(true)); return () => window.cancelAnimationFrame(frame); }, []);
  const place = placePreview(anchor, visibleViewport(), height);
  const style = { left: place.left, top: place.top, width: place.width, transformOrigin: `${place.originX}px ${place.originY}px`, '--preview-start': place.startScale } as CSSProperties;
  const image = details?.backdropUrl ?? movie.posterUrl;
  const facts = previewFacts(movie.year, formatRuntime(details?.runtime, movie.durationMs), details?.rating);
  const chips = qualityChips(movie);
  return <div ref={panel} role="group" aria-label={`${movie.title} preview`} {...handlers} style={style} className={`fixed z-40 overflow-hidden rounded-xl bg-surface shadow-2xl ring-1 ring-accent transition-[opacity,transform] duration-base ease-standard motion-reduce:scale-100 ${entered ? 'scale-100 opacity-100' : 'scale-[var(--preview-start)] opacity-0'}`}>
    <div className="relative aspect-video bg-surface-raised">{image && <img src={image} alt="" className="h-full w-full object-cover" />}</div>
    <div className="space-y-2 p-3">
      <h3 className="line-clamp-1 font-semibold text-foreground">{movie.title}</h3>
      {(facts || chips.length > 0) && <div className="flex flex-wrap items-center gap-2 text-xs text-muted">{facts && <span>{facts}</span>}{chips.map((chip) => <span key={chip} className="rounded border border-border px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-foreground">{chip}</span>)}</div>}
      {details?.overview && <p className="line-clamp-2 text-sm text-muted">{details.overview}</p>}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!movie.missing && <Link to={open.playTo} viewTransition className={`inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover ${pressable} ${focusRing}`}><svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7V5Z" /></svg>{playLabel(movie.resumePositionMs)}</Link>}
        <button type="button" onClick={onToggleWatched} aria-pressed={movie.watched} aria-label={movie.watched ? `Mark ${movie.title} as unwatched` : `Mark ${movie.title} as watched`} className={secondaryButton}>{movie.watched ? 'Watched' : 'Mark watched'}</button>
        <Link to={open.to} state={open.state} onClick={open.onClick} className={secondaryButton}>Details</Link>
        {details?.trailerKey && <button type="button" onClick={() => onTrailer(details.trailerKey!)} className={secondaryButton}>Trailer</button>}
      </div>
    </div>
  </div>;
}
