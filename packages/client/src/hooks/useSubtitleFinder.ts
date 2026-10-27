import { useCallback, useState } from 'react';
import { useMovie } from './useMovies';

/**
 * The player's "Find subtitles…": whether the finder is open and the title it needs (title, year, season, episode,
 * filename), fetched only once the finder is opened.
 */
export function useSubtitleFinder(movieId: number) {
  const [open, setOpen] = useState(false);
  const movie = useMovie(open ? String(movieId) : undefined);
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  return { open, movie: open ? movie.data ?? null : null, show, close };
}
