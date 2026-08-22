import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Movie } from '@ottlib/shared';
import { DragHandleIcon } from './icons';
import { NoArtworkCard } from './NoArtworkCard';
import { ShelfCardMenu } from './ShelfCardMenu';

interface ShelfMovieGridProps { movies: Movie[]; busy?: boolean; onRemove: (movieId: number) => void; onReorder: (movieIds: number[]) => void }

function movieIdAtPoint(clientX: number, clientY: number): number | undefined {
  const card = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-shelf-movie-id]');
  const id = Number(card?.dataset.shelfMovieId);
  return Number.isInteger(id) ? id : undefined;
}

export function ShelfMovieGrid({ movies, busy, onRemove, onReorder }: ShelfMovieGridProps) {
  const [ordered, setOrdered] = useState(movies);
  const [draggingId, setDraggingId] = useState<number>();
  const orderedRef = useRef(movies);
  const pointerId = useRef<number | undefined>(undefined);
  const movedDuringDrag = useRef(false);

  useEffect(() => { orderedRef.current = movies; setOrdered(movies); }, [movies]);

  const move = (fromId: number, toId: number | undefined, persist = true): boolean => {
    if (toId === undefined || fromId === toId) return false;
    const current = [...orderedRef.current]; const from = current.findIndex((movie) => movie.id === fromId); const to = current.findIndex((movie) => movie.id === toId);
    if (from < 0 || to < 0) return false;
    const [moved] = current.splice(from, 1); current.splice(to, 0, moved); orderedRef.current = current; setOrdered(current);
    if (persist) onReorder(current.map((movie) => movie.id));
    return true;
  };

  const startPointerDrag = (event: PointerEvent<HTMLButtonElement>, movieId: number) => {
    if (busy || !event.isPrimary) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pointerId.current = event.pointerId; movedDuringDrag.current = false; setDraggingId(movieId);
  };
  const movePointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId || draggingId === undefined) return;
    const targetId = movieIdAtPoint(event.clientX, event.clientY);
    if (move(draggingId, targetId, false)) movedDuringDrag.current = true;
  };
  const finishPointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (movedDuringDrag.current) onReorder(orderedRef.current.map((movie) => movie.id));
    pointerId.current = undefined; movedDuringDrag.current = false; setDraggingId(undefined);
  };

  return <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">{ordered.map((movie, index) => <article key={movie.id} data-shelf-movie-id={movie.id} className={`group relative overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-border transition ${draggingId === movie.id ? 'opacity-50 ring-accent' : ''}`}>
    <Link to={`/movie/${movie.id}`} className="block"><div className="aspect-[2/3] bg-surface-raised">{movie.posterUrl ? <img src={movie.posterUrl} alt={`${movie.title} poster`} draggable={false} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <NoArtworkCard title={movie.title} year={movie.year} status={movie.metadataStatus} />}</div><div className="p-3"><div className="truncate font-medium text-foreground">{movie.title}</div><div className="mt-1 text-xs text-muted">{movie.year ?? '—'}</div></div></Link>
    {movie.missing && <span className="absolute right-2 top-12 rounded-full bg-error px-2 py-0.5 text-xs font-medium text-error-solid-foreground">Unavailable</span>}
    <button type="button" onPointerDown={(event) => startPointerDrag(event, movie.id)} onPointerMove={movePointerDrag} onPointerUp={finishPointerDrag} onPointerCancel={finishPointerDrag} disabled={busy} className="absolute left-2 top-2 cursor-grab touch-none rounded bg-field/90 p-1 text-foreground/90 active:cursor-grabbing disabled:cursor-not-allowed" title="Drag to reorder" aria-label={`Drag ${movie.title} to reorder`}><DragHandleIcon className="h-4 w-4" /></button>
    <ShelfCardMenu title={movie.title} busy={busy} canMoveUp={index > 0} canMoveDown={index < ordered.length - 1} onMoveUp={() => move(movie.id, ordered[index - 1]?.id)} onMoveDown={() => move(movie.id, ordered[index + 1]?.id)} onRemove={() => onRemove(movie.id)} />
  </article>)}</div>;
}
