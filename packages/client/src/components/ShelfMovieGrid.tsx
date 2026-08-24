import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Movie } from '@ottlib/shared';
import { DragHandleIcon } from './icons';
import { NoArtworkCard } from './NoArtworkCard';
import { PosterImage } from './PosterImage';
import { ShelfCardMenu } from './ShelfCardMenu';

interface ShelfMovieGridProps { shelfId: number; movies: Movie[]; busy?: boolean; onRemove: (movieId: number) => void; onReorder: (movieIds: number[]) => void }

function movieIdAtPoint(clientX: number, clientY: number): number | undefined {
  const card = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-shelf-movie-id]');
  const id = Number(card?.dataset.shelfMovieId);
  return Number.isInteger(id) ? id : undefined;
}

export function ShelfMovieGrid({ shelfId, movies, busy, onRemove, onReorder }: ShelfMovieGridProps) {
  const [ordered, setOrdered] = useState(movies);
  const [draggingId, setDraggingId] = useState<number>();
  const [dropTargetId, setDropTargetId] = useState<number>();
  const orderedRef = useRef(movies);
  const pointerId = useRef<number | undefined>(undefined);
  const movedDuringDrag = useRef(false);
  const previousPositions = useRef(new Map<number, DOMRect>());
  const pointerPosition = useRef<{ x: number; y: number } | undefined>(undefined);
  const moveFrame = useRef<number | undefined>(undefined);

  useEffect(() => { orderedRef.current = movies; setOrdered(movies); }, [movies]);
  useEffect(() => () => { if (moveFrame.current !== undefined) window.cancelAnimationFrame(moveFrame.current); }, []);

  useLayoutEffect(() => {
    if (!previousPositions.current.size) return;
    document.querySelectorAll<HTMLElement>('[data-shelf-movie-id]').forEach((card) => {
      const movieId = Number(card.dataset.shelfMovieId);
      const previous = previousPositions.current.get(movieId);
      if (!previous || movieId === draggingId) return;
      const current = card.getBoundingClientRect();
      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;
      if (deltaX || deltaY) card.animate([{ transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` }, { transform: 'none' }], { duration: 220, easing: 'var(--ease-standard)' });
    });
    previousPositions.current.clear();
  }, [ordered, draggingId]);

  const capturePositions = () => {
    previousPositions.current = new Map([...document.querySelectorAll<HTMLElement>('[data-shelf-movie-id]')].map((card) => [Number(card.dataset.shelfMovieId), card.getBoundingClientRect()]));
  };

  const move = (fromId: number, toId: number | undefined, persist = true): boolean => {
    if (toId === undefined || fromId === toId) return false;
    const current = [...orderedRef.current]; const from = current.findIndex((movie) => movie.id === fromId); const to = current.findIndex((movie) => movie.id === toId);
    if (from < 0 || to < 0) return false;
    capturePositions(); const [moved] = current.splice(from, 1); current.splice(to, 0, moved); orderedRef.current = current; setOrdered(current);
    if (persist) onReorder(current.map((movie) => movie.id));
    return true;
  };

  const startPointerDrag = (event: PointerEvent<HTMLButtonElement>, movieId: number) => {
    if (busy || !event.isPrimary) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pointerId.current = event.pointerId; movedDuringDrag.current = false; setDraggingId(movieId); setDropTargetId(undefined);
  };
  const movePointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId || draggingId === undefined) return;
    pointerPosition.current = { x: event.clientX, y: event.clientY };
    if (moveFrame.current !== undefined) return;
    moveFrame.current = window.requestAnimationFrame(() => {
      moveFrame.current = undefined;
      const pointer = pointerPosition.current;
      if (!pointer || pointerId.current !== event.pointerId) return;
      const targetId = movieIdAtPoint(pointer.x, pointer.y);
      setDropTargetId(targetId === draggingId ? undefined : targetId);
      if (move(draggingId, targetId, false)) movedDuringDrag.current = true;
    });
  };
  const finishPointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (movedDuringDrag.current) onReorder(orderedRef.current.map((movie) => movie.id));
    pointerId.current = undefined; movedDuringDrag.current = false; setDraggingId(undefined); setDropTargetId(undefined);
  };

  return <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">{ordered.map((movie, index) => <article key={movie.id} data-shelf-movie-id={movie.id} className={`group relative overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-border transition-[transform,box-shadow,opacity] duration-fast ease-emphasis ${draggingId === movie.id ? 'z-10 scale-105 cursor-grabbing opacity-90 shadow-2xl ring-accent' : ''} ${dropTargetId === movie.id ? 'ring-2 ring-dashed ring-accent' : ''}`}>
    <Link to={`/movie/${movie.id}`} state={{ fromShelf: true, shelfId }} className="block"><div className="aspect-[2/3] bg-surface-raised">{movie.posterUrl ? <PosterImage src={movie.posterUrl} alt={`${movie.title} poster`} draggable={false} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <NoArtworkCard title={movie.title} year={movie.year} status={movie.metadataStatus} />}</div><div className="p-3"><div className="truncate font-medium text-foreground">{movie.title}</div><div className="mt-1 text-xs text-muted">{movie.year ?? '—'}</div></div></Link>
    {movie.missing && <span className="absolute right-2 top-12 rounded-full bg-error px-2 py-0.5 text-xs font-medium text-error-solid-foreground">Unavailable</span>}
    <button type="button" onPointerDown={(event) => startPointerDrag(event, movie.id)} onPointerMove={movePointerDrag} onPointerUp={finishPointerDrag} onPointerCancel={finishPointerDrag} disabled={busy} className="absolute left-2 top-2 cursor-grab touch-none rounded bg-field/90 p-1 text-foreground/90 active:cursor-grabbing disabled:cursor-not-allowed" title="Drag to reorder" aria-label={`Drag ${movie.title} to reorder`}><DragHandleIcon className="h-4 w-4" /></button>
    <ShelfCardMenu title={movie.title} busy={busy} canMoveUp={index > 0} canMoveDown={index < ordered.length - 1} onMoveUp={() => move(movie.id, ordered[index - 1]?.id)} onMoveDown={() => move(movie.id, ordered[index + 1]?.id)} onRemove={() => onRemove(movie.id)} />
  </article>)}</div>;
}
