import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Movie } from '@ottlib/shared';
import { DragHandleIcon } from './icons';

interface ShelfMovieGridProps { movies: Movie[]; busy?: boolean; onRemove: (movieId: number) => void; onReorder: (movieIds: number[]) => void }

export function ShelfMovieGrid({ movies, busy, onRemove, onReorder }: ShelfMovieGridProps) {
  const [ordered, setOrdered] = useState(movies);
  const [draggingId, setDraggingId] = useState<number>();
  useEffect(() => setOrdered(movies), [movies]);
  const move = (fromId: number, toId: number) => {
    if (fromId === toId) return;
    const current = [...ordered]; const from = current.findIndex((movie) => movie.id === fromId); const to = current.findIndex((movie) => movie.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = current.splice(from, 1); current.splice(to, 0, moved); setOrdered(current); onReorder(current.map((movie) => movie.id));
  };
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">{ordered.map((movie) => <article key={movie.id} draggable onDragStart={() => setDraggingId(movie.id)} onDragEnd={() => setDraggingId(undefined)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggingId) move(draggingId, movie.id); }} className={`group relative overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-border transition ${draggingId === movie.id ? 'opacity-50' : ''}`}>
    <Link to={`/movie/${movie.id}`} className="block"><div className="aspect-[2/3] bg-surface-raised">{movie.posterUrl ? <img src={movie.posterUrl} alt={`${movie.title} poster`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-subtle">No poster<br />{movie.title}</div>}</div><div className="p-3"><div className="truncate font-medium text-foreground">{movie.title}</div><div className="mt-1 text-xs text-muted">{movie.year ?? '—'}</div></div></Link>
    {movie.missing && <span className="absolute right-2 top-2 rounded-full bg-error px-2 py-0.5 text-xs font-medium text-error-solid-foreground">Unavailable</span>}
    <span className="absolute left-2 top-2 cursor-grab rounded bg-field/90 p-1 text-foreground/90" title="Drag to reorder" aria-label="Drag to reorder"><DragHandleIcon className="h-4 w-4" /></span>
    <button type="button" onClick={() => onRemove(movie.id)} disabled={busy} className="absolute bottom-2 right-2 rounded bg-error-soft/90 px-2 py-1 text-xs text-error opacity-0 transition group-hover:opacity-100 focus:opacity-100 disabled:opacity-50">Remove</button>
  </article>)}</div>;
}
