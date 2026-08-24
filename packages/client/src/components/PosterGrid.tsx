import { useLayoutEffect, useRef, useState } from 'react';
import type { MovieListItem } from '@ottlib/shared';
import { MatchReviewDialog } from './MatchReviewDialog';
import { PosterCard } from './PosterCard';
import { useMovieActions } from '../hooks/useMovies';

export function PosterGrid({ movies, selectedIds = new Set<number>(), onSelectionChange, shelfId, animateInitial = true }: { movies: MovieListItem[]; selectedIds?: Set<number>; onSelectionChange?: (ids: Set<number>) => void; shelfId?: number; animateInitial?: boolean }) {
  const [reviewingId, setReviewingId] = useState<number>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const [initialRowSize, setInitialRowSize] = useState(0);
  const initialMovieIds = useRef(new Set(movies.map((movie) => movie.id)));
  useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const update = () => {
      const columns = Math.max(1, Math.floor((element.clientWidth + 16) / 156));
      setInitialRowSize(columns * 3);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const actions = useMovieActions();
  const reviewingMovie = movies.find((movie) => movie.id === reviewingId);
  const setSelected = (id: number, selected: boolean) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds); selected ? next.add(id) : next.delete(id); onSelectionChange(next);
  };
  return <><div ref={grid} className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">{movies.map((movie, index) => {
    const animate = animateInitial && index < initialRowSize && initialMovieIds.current.has(movie.id);
    return <div key={movie.id} className={animate ? 'animate-rise-in' : ''} style={animate ? { animationDelay: `${index * 35}ms` } : undefined}><PosterCard movie={movie} shelfId={shelfId} selected={selectedIds.has(movie.id)} onSelectedChange={onSelectionChange && !movie.missing ? (selected) => setSelected(movie.id, selected) : undefined} onReview={() => { setReviewingId(movie.id); setReviewOpen(true); }} onToggleWatched={() => actions.watch.mutate({ id: movie.id, watched: !movie.watched, silent: true })} /></div>;
  })}</div>{reviewingMovie && <MatchReviewDialog open={reviewOpen} movieId={reviewingMovie.id} title={reviewingMovie.title} year={reviewingMovie.year} onClose={() => setReviewOpen(false)} />}</>;
}
