import { useQuery } from '@tanstack/react-query';
import type { MovieFilterOptions, MovieListItem, MovieListPage, ShelfDetail, ShelfSummary } from '@ottlib/shared';
import { api } from './apiClient';
import { homeGenres } from '../utils/homeGenres';
import { toShelfPosterItems } from '../utils/shelfMovieFilters';

export interface HomeRow { key: string; title: string; items: MovieListItem[]; seeAllPath?: string }

export const homeRowsQueryKey = ['home-rows'];

const optional = <T,>(request: Promise<T>, fallback: T) => request.catch(() => fallback);

/** The same rows the TV and phone apps open on: continue watching, recent, unwatched, each shelf, then a few genres. */
async function loadHomeRows(): Promise<HomeRow[]> {
  const [continueWatching, recent, unwatched, shelves, options] = await Promise.all([
    optional(api<MovieListItem[]>('/api/movies/continue-watching?limit=20'), []),
    api<MovieListPage>('/api/movies?sort=added&limit=30'),
    api<MovieListPage>('/api/movies?sort=added&watched=false&limit=30'),
    optional(api<ShelfSummary[]>('/api/shelves'), []),
    optional(api<MovieFilterOptions>('/api/movies/filter-options'), undefined)
  ]);
  const [shelfRows, genreRows] = await Promise.all([
    Promise.all(shelves.filter((shelf) => shelf.movieCount > 0).map((summary) => optional(api<ShelfDetail>(`/api/shelves/${summary.id}`).then((shelf): HomeRow => ({ key: `shelf-${shelf.id}`, title: shelf.name, items: toShelfPosterItems(shelf.movies.filter((movie) => !movie.missing)), seeAllPath: `/shelves/${shelf.id}` })), undefined))),
    Promise.all(homeGenres(options?.genres ?? []).map((genre) => optional(api<MovieListPage>(`/api/movies?${new URLSearchParams({ genre, sort: 'added', limit: '24' })}`).then((page): HomeRow => ({ key: `genre-${genre}`, title: genre, items: page.items, seeAllPath: `/library?${new URLSearchParams({ genre })}` })), undefined)))
  ]);
  return [
    { key: 'continue', title: 'Continue watching', items: continueWatching },
    { key: 'recent', title: 'Recently added', items: recent.items, seeAllPath: '/library?sort=added' },
    { key: 'unwatched', title: 'Unwatched', items: unwatched.items, seeAllPath: '/library?sort=added&watched=false' },
    ...shelfRows.filter((row): row is HomeRow => row !== undefined),
    ...genreRows.filter((row): row is HomeRow => row !== undefined)
  ].filter((row) => row.items.length > 0);
}

export function useHomeRows() {
  return useQuery({ queryKey: homeRowsQueryKey, queryFn: loadHomeRows });
}
