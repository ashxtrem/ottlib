import { useRef } from 'react';
import { Link } from 'react-router-dom';
import type { HomeRow } from '../hooks/useHomeRows';
import { useLazyRow } from '../hooks/useLazyRow';
import { useMovieActions } from '../hooks/useMovies';
import { useRovingRow } from '../hooks/useRovingRow';
import { useRowDragScroll } from '../hooks/useRowDragScroll';
import { useRowOffset } from '../hooks/useRowOffset';
import { PosterCard } from './PosterCard';
import { focusRing } from './interactionStyles';

/** Height of a rendered row (heading + one line of cards), so a row that is not rendered yet keeps its place. */
export const rowPlaceholderClass = 'h-[396px] sm:h-[420px]';

interface HomeRowSectionProps { row: HomeRow; index: number; restoreOffset: boolean }

/** One titled, sideways-scrolling row of posters on the home screen. Rows past the first few render when they come near. */
export function HomeRowSection({ row, index, restoreOffset }: HomeRowSectionProps) {
  const { ref, near } = useLazyRow(index);
  if (!near) return <div ref={ref} aria-hidden="true" data-row-placeholder={row.key} className={rowPlaceholderClass} />;
  return <HomeRowContent row={row} restoreOffset={restoreOffset} />;
}

function HomeRowContent({ row, restoreOffset }: { row: HomeRow; restoreOffset: boolean }) {
  const actions = useMovieActions();
  const listRef = useRef<HTMLUListElement>(null);
  const roving = useRovingRow(listRef, row.items.length);
  useRowDragScroll(listRef);
  useRowOffset(listRef, row.key, restoreOffset);
  const headingId = `home-row-${row.key}`;
  return <section aria-labelledby={headingId}>
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={headingId} className="text-lg font-semibold">{row.title}</h2>
      {row.seeAllPath && <Link to={row.seeAllPath} viewTransition className={`shrink-0 rounded text-sm font-medium text-accent hover:underline ${focusRing}`}>See all</Link>}
    </div>
    <ul ref={listRef} onKeyDown={roving.onKeyDown} onFocus={roving.onFocus} className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:thin]">{row.items.map((movie) => <li key={movie.id} className="w-36 shrink-0 snap-start sm:w-40">
      <PosterCard movie={movie} onToggleWatched={() => actions.watch.mutate({ id: movie.id, watched: !movie.watched, silent: true })} />
    </li>)}</ul>
  </section>;
}
