import type { Movie, ShelfMembership } from '@ottlib/shared';
import { MovieRepository, type MovieListQuery } from '../repositories/movieRepository.js';
import { ShelfMovieRepository } from '../repositories/shelfMovieRepository.js';
import { MediaTrackRepository } from '../repositories/mediaTrackRepository.js';

export class LibraryService {
  public constructor(private readonly movies: MovieRepository, private readonly shelfMovies: ShelfMovieRepository, private readonly mediaTracks: MediaTrackRepository) {}

  public list(deviceId: string | undefined, query: MovieListQuery): Movie[] {
    return this.withShelves(this.movies.list(deviceId, query));
  }

  public get(id: number, deviceId?: string): Movie | undefined {
    const movie = this.movies.get(id, deviceId);
    return movie && this.withShelves([movie])[0];
  }

  public listByIds(ids: number[], deviceId?: string): Movie[] {
    return this.withShelves(this.movies.listByIds(ids, deviceId));
  }

  private withShelves(movies: Movie[]): Movie[] {
    const memberships = this.shelfMovies.listMemberships(movies.map((movie) => movie.id));
    const tracks = this.mediaTracks.listByMovieIds(movies.map((movie) => movie.id));
    return movies.map((movie) => ({
      ...movie,
      mediaInfo: movie.mediaInfo ? { ...movie.mediaInfo, tracks: tracks.get(movie.id) ?? [] } : null,
      shelves: memberships.get(movie.id) ?? [] as ShelfMembership[]
    }));
  }
}
