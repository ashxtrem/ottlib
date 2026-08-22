import { useState } from 'react';
import type { MovieListItem } from '@ottlib/shared';
import { MatchReviewDialog } from './MatchReviewDialog';
import { PosterCard } from './PosterCard';
import { useMovieActions } from '../hooks/useMovies';

export function PosterGrid({ movies }: { movies: MovieListItem[] }) {
  const [reviewingId, setReviewingId] = useState<number>();
  const actions = useMovieActions();
  const reviewingMovie = movies.find((movie) => movie.id === reviewingId);
  return <><div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">{movies.map((movie) => <PosterCard key={movie.id} movie={movie} onReview={() => setReviewingId(movie.id)} onToggleWatched={() => actions.watch.mutate({ id: movie.id, watched: !movie.watched, silent: true })} />)}</div>{reviewingMovie && <MatchReviewDialog open movieId={reviewingMovie.id} title={reviewingMovie.title} year={reviewingMovie.year} onClose={() => setReviewingId(undefined)} />}</>;
}
