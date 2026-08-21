import { Link } from 'react-router-dom';
import type { Movie } from '@ottlib/shared';
import { saveLibraryScrollPosition } from '../hooks/useLibraryScrollRestoration';

export function PosterCard({ movie }: { movie: Movie }) {
  const firstShelf = movie.shelves[0];
  return <article className="group relative overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-border transition hover:-translate-y-1 hover:ring-accent">
    <Link to={`/movie/${movie.id}`} onClick={saveLibraryScrollPosition} className="block"><div className="aspect-[2/3] bg-surface-raised">{movie.posterUrl ? <img src={movie.posterUrl} alt={`${movie.title} poster`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-subtle">No poster<br />{movie.title}</div>}</div>
      <div className="p-3"><div className="truncate font-medium text-foreground">{movie.title}</div><div className="mt-1 flex justify-between text-xs text-muted"><span>{movie.year ?? '—'}</span>{movie.watched && <span className="text-success">Watched</span>}</div></div>
    </Link>
    {firstShelf && <Link to={`/shelves/${firstShelf.id}`} onClick={(event) => event.stopPropagation()} className="absolute left-2 top-2 z-10 max-w-[75%] truncate rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground shadow"><span>{firstShelf.name}</span>{movie.shelves.length > 1 && <span> +{movie.shelves.length - 1}</span>}</Link>}
    {movie.metadataStatus === 'suggested' && <span className="absolute right-2 top-2 z-10 rounded-full bg-warning-border px-2 py-0.5 text-xs font-medium text-warning-foreground">Needs review</span>}
  </article>;
}
