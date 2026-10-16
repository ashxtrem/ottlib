import { Link, useLocation } from 'react-router-dom';
import type { Recommendation } from '@ottlib/shared';
import { hideKeyOf } from '@ottlib/shared';
import { NoArtworkCard } from './NoArtworkCard';
import { PosterImage } from './PosterImage';
import { focusRing, liftable } from './interactionStyles';
import { useHiddenTitles } from '../hooks/useHiddenTitles';
import { useMovieRecommendations } from '../hooks/useMovies';

const shown = 12;

/** "More like this": jump to another title without going back to the library. Hidden titles are left out. */
export function RecommendationsRow({ movieId }: { movieId: string }) {
  const recommendations = useMovieRecommendations(movieId);
  const { hidden } = useHiddenTitles();
  const { state } = useLocation();
  const hiddenKeys = new Set(hidden.map((entry) => entry.key));
  const items = (recommendations.data ?? []).filter((item: Recommendation) => !hiddenKeys.has(hideKeyOf(item.movie))).slice(0, shown);
  if (!items.length) return null;
  return <section aria-labelledby="more-like-this" className="rounded-xl border border-border bg-surface p-5">
    <h2 id="more-like-this" className="font-semibold">More like this</h2>
    <ul className="mt-4 flex gap-4 overflow-x-auto pb-2">{items.map(({ movie, reason }) => <li key={movie.id} className="w-36 shrink-0">
      <Link to={`/movie/${movie.id}`} state={state} className={`block overflow-hidden rounded-xl bg-surface-raised ring-1 ring-border ${liftable} hover:ring-accent ${focusRing}`} aria-label={`${movie.title}. ${reason}`}>
        <div className="aspect-[2/3] overflow-hidden">{movie.posterUrl ? <PosterImage src={movie.posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <NoArtworkCard title={movie.title} year={movie.year} status={movie.metadataStatus} />}</div>
      </Link>
      <p className="mt-2 line-clamp-2 break-words text-sm font-medium">{movie.title}{movie.year ? <span className="text-muted"> ({movie.year})</span> : null}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{reason}</p>
    </li>)}</ul>
  </section>;
}
