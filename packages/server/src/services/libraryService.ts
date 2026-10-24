import type { Movie, MovieListPage, ShelfMembership } from '@ottlib/shared';
import { MovieRepository, type MovieListQuery } from '../repositories/movieRepository.js';
import { ShelfMovieRepository } from '../repositories/shelfMovieRepository.js';
import { MediaTrackRepository } from '../repositories/mediaTrackRepository.js';

export class LibraryService {
  public constructor(private readonly movies: MovieRepository, private readonly shelfMovies: ShelfMovieRepository, private readonly mediaTracks: MediaTrackRepository) {}

  public listSummaries(profileId: number | undefined, query: MovieListQuery): MovieListPage {
    const page = this.movies.listSummaries(profileId, query);
    const memberships = this.shelfMovies.listMemberships(page.items.map((movie) => movie.id));
    return { ...page, items: page.items.map((movie) => ({ ...movie, shelves: memberships.get(movie.id) ?? [] as ShelfMembership[] })) };
  }

  public get(id: number, profileId?: number): Movie | undefined {
    const movie = this.movies.get(id, profileId);
    return movie && this.withShelves([movie])[0];
  }

  public listByIds(ids: number[], profileId?: number): Movie[] {
    return this.withShelves(this.movies.listByIds(ids, profileId));
  }

  public listDuplicates(id: number, profileId?: number): Movie[] {
    return this.listByIds(this.movies.findDuplicateIds(id), profileId);
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
