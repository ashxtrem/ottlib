import { Link } from 'react-router-dom';
import type { HomeRow } from '../hooks/useHomeRows';
import { useMovieActions } from '../hooks/useMovies';
import { PosterCard } from './PosterCard';
import { focusRing } from './interactionStyles';

/** One titled, sideways-scrolling row of posters on the home screen. */
export function HomeRowSection({ row }: { row: HomeRow }) {
  const actions = useMovieActions();
  const headingId = `home-row-${row.key}`;
  return <section aria-labelledby={headingId}>
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={headingId} className="text-lg font-semibold">{row.title}</h2>
      {row.seeAllPath && <Link to={row.seeAllPath} viewTransition className={`shrink-0 rounded text-sm font-medium text-accent hover:underline ${focusRing}`}>See all</Link>}
    </div>
    <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:thin]">{row.items.map((movie) => <li key={movie.id} className="w-36 shrink-0 snap-start sm:w-40">
      <PosterCard movie={movie} onToggleWatched={() => actions.watch.mutate({ id: movie.id, watched: !movie.watched, silent: true })} />
    </li>)}</ul>
  </section>;
}
