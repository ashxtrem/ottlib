import { Link } from 'react-router-dom';
import type { ShelfSummary } from '@ottlib/shared';

export function ShelfCard({ shelf }: { shelf: ShelfSummary }) {
  return <Link to={`/shelves/${shelf.id}`} className="group overflow-hidden rounded-2xl bg-surface shadow-lg ring-1 ring-border transition hover:-translate-y-1 hover:ring-accent">
    <div className="grid aspect-video grid-cols-2 grid-rows-2 overflow-hidden bg-surface-raised">{shelf.coverMovies.length ? shelf.coverMovies.map((movie) => <div key={movie.id} className="min-h-0 bg-surface-raised">{movie.posterUrl ? <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full bg-surface-raised" />}</div>) : <div className="col-span-2 row-span-2 flex items-center justify-center text-subtle">No titles</div>}</div>
    <div className="p-4"><h2 className="truncate font-semibold text-foreground">{shelf.name}</h2><p className="mt-1 text-sm text-muted">{shelf.movieCount} title{shelf.movieCount === 1 ? '' : 's'}</p></div>
  </Link>;
}
