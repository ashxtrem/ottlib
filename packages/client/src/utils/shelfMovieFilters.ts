import { formatResolution, type Movie, type MovieFilterOptions, type MovieListItem } from '@ottlib/shared';

export interface ShelfMovieFilters {
  search: string;
  availability: 'available' | 'unavailable' | undefined;
  genre: string;
  actor: string;
  quality: string;
  audioLanguage: string;
  minRating: number | undefined;
  watched: boolean | undefined;
  sort: string;
  needsReview: boolean;
}

export const initialShelfMovieFilters: ShelfMovieFilters = {
  search: '', availability: undefined, genre: '', actor: '', quality: '', audioLanguage: '', minRating: undefined, watched: undefined, sort: 'title', needsReview: false
};

export function shelfMovieFilterOptions(movies: Movie[]): MovieFilterOptions {
  const uniqueSorted = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  return {
    genres: uniqueSorted(movies.flatMap((movie) => movie.genres)),
    actors: uniqueSorted(movies.flatMap((movie) => movie.cast)),
    resolutions: uniqueSorted(movies.flatMap((movie) => formatResolution(movie.mediaInfo?.height) ?? [])).sort((left, right) => resolutionRank(right) - resolutionRank(left)),
    audioLanguages: uniqueSorted(movies.flatMap((movie) => movie.mediaInfo?.tracks.filter((track) => track.type === 'audio').flatMap((track) => track.language ?? '') ?? []))
  };
}

export function filterShelfMovies(movies: Movie[], filters: ShelfMovieFilters): Movie[] {
  const search = filters.search.trim().toLowerCase(); const genre = filters.genre.toLowerCase(); const actor = filters.actor.trim().toLowerCase(); const audioLanguage = filters.audioLanguage.toLowerCase();
  const filtered = movies.filter((movie) => {
    if (search && !movie.title.toLowerCase().includes(search) && !movie.imdbId?.toLowerCase().includes(search)) return false;
    if (filters.availability === 'available' && movie.missing) return false;
    if (filters.availability === 'unavailable' && !movie.missing) return false;
    if (genre && !movie.genres.some((value) => value.toLowerCase().includes(genre))) return false;
    if (actor && !movie.cast.some((value) => value.toLowerCase().includes(actor))) return false;
    if (filters.quality && formatResolution(movie.mediaInfo?.height) !== filters.quality) return false;
    if (audioLanguage && !movie.mediaInfo?.tracks.some((track) => track.type === 'audio' && track.language?.toLowerCase() === audioLanguage)) return false;
    if (filters.minRating !== undefined && (movie.rating === null || movie.rating < filters.minRating)) return false;
    if (filters.watched !== undefined && movie.watched !== filters.watched) return false;
    if (filters.needsReview && movie.metadataStatus !== 'suggested') return false;
    return true;
  });
  return filtered.sort((left, right) => compareMovies(left, right, filters.sort));
}

export function toShelfPosterItems(movies: Movie[]): MovieListItem[] {
  return movies.map((movie) => ({
    id: movie.id, title: movie.title, year: movie.year, posterUrl: movie.posterUrl, resolution: formatResolution(movie.mediaInfo?.height), hdrFormat: movie.mediaInfo?.hdrFormat ?? null,
    watched: movie.watched, resumePositionMs: movie.resumePositionMs, durationMs: movie.mediaInfo?.durationMs ?? null, missing: movie.missing, metadataStatus: movie.metadataStatus, shelves: movie.shelves
  }));
}

function compareMovies(left: Movie, right: Movie, sort: string): number {
  if (sort === 'year') return (right.year ?? -1) - (left.year ?? -1) || left.title.localeCompare(right.title);
  if (sort === 'added') return Date.parse(right.addedAt) - Date.parse(left.addedAt) || left.title.localeCompare(right.title);
  if (sort === 'quality') return (left.mediaInfo?.height ?? -1) < (right.mediaInfo?.height ?? -1) ? 1 : (left.mediaInfo?.height ?? -1) > (right.mediaInfo?.height ?? -1) ? -1 : left.title.localeCompare(right.title);
  return left.title.localeCompare(right.title);
}

function resolutionRank(value: string): number { return value === '4K' ? 2160 : Number.parseInt(value, 10) || 0; }
