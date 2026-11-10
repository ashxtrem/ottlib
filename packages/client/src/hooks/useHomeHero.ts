import type { Movie, MovieListItem } from '@ottlib/shared';
import type { HomeRow } from './useHomeRows';
import { useMovie } from './useMovies';

export interface HomeHeroData { item: MovieListItem; movie: Movie | undefined; isLoading: boolean }

/** Rows whose first title can be featured, in order of preference. */
const heroRowKeys = ['continue', 'unwatched'];

/** The top Continue watching title, else the newest unwatched one; null when neither row has a visible title. */
export function pickHeroItem(rows: HomeRow[] | undefined, isHidden: (item: MovieListItem) => boolean = () => false): MovieListItem | null {
  for (const key of heroRowKeys) {
    const item = rows?.find((row) => row.key === key)?.items.find((candidate) => !isHidden(candidate));
    if (item) return item;
  }
  return null;
}

/** The title featured above the Home rows, with its details (list rows carry no backdrop or overview). */
export function useHomeHero(rows: HomeRow[] | undefined): HomeHeroData | null {
  const item = pickHeroItem(rows);
  const movie = useMovie(item ? String(item.id) : undefined);
  if (!item) return null;
  return { item, movie: movie.data, isLoading: movie.isLoading };
}
