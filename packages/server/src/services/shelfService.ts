import type { Movie, ShelfDetail, ShelfSummary } from '@ottlib/shared';
import { MovieRepository } from '../repositories/movieRepository.js';
import { ShelfMovieRepository } from '../repositories/shelfMovieRepository.js';
import { ShelfRepository, type ShelfRecord } from '../repositories/shelfRepository.js';
import { LibraryService } from './libraryService.js';

export type ShelfResult<T> = { value: T } | { error: 'shelf-not-found' | 'movie-not-found' | 'name-conflict' | 'last-movie' | 'invalid-order' };

export class ShelfService {
  public constructor(
    private readonly shelves: ShelfRepository,
    private readonly shelfMovies: ShelfMovieRepository,
    private readonly movies: MovieRepository,
    private readonly library: LibraryService
  ) {}

  public list(): ShelfSummary[] {
    return this.shelves.list().map((shelf) => this.summary(shelf));
  }

  public get(id: number, deviceId?: string): ShelfDetail | undefined {
    const shelf = this.shelves.get(id);
    return shelf && this.detail(shelf, deviceId);
  }

  public create(name: string, movieIds: number[], deviceId?: string): ShelfResult<ShelfDetail> {
    if (this.shelves.nameExists(name)) return { error: 'name-conflict' };
    if (!this.movies.hasAll(movieIds)) return { error: 'movie-not-found' };
    const shelf = this.shelves.transaction(() => {
      const created = this.shelves.create(name);
      this.shelfMovies.addMovies(created.id, unique(movieIds));
      return created;
    });
    return { value: this.detail(shelf, deviceId) };
  }

  public rename(id: number, name: string): ShelfResult<ShelfSummary> {
    if (!this.shelves.exists(id)) return { error: 'shelf-not-found' };
    if (this.shelves.nameExists(name, id)) return { error: 'name-conflict' };
    const shelf = this.shelves.rename(id, name)!;
    return { value: this.summary(shelf) };
  }

  public remove(id: number): ShelfResult<undefined> {
    return this.shelves.remove(id) ? { value: undefined } : { error: 'shelf-not-found' };
  }

  public addMovies(id: number, movieIds: number[], deviceId?: string): ShelfResult<ShelfDetail> {
    if (!this.shelves.exists(id)) return { error: 'shelf-not-found' };
    if (!this.movies.hasAll(movieIds)) return { error: 'movie-not-found' };
    this.shelves.transaction(() => {
      this.shelfMovies.addMovies(id, unique(movieIds));
      this.shelves.touch(id);
    });
    return { value: this.get(id, deviceId)! };
  }

  public removeMovie(id: number, movieId: number, deviceId?: string): ShelfResult<ShelfDetail> {
    if (!this.shelves.exists(id)) return { error: 'shelf-not-found' };
    const movieIds = this.shelfMovies.listMovieIds(id);
    if (!movieIds.includes(movieId)) return { error: 'movie-not-found' };
    if (movieIds.length === 1) return { error: 'last-movie' };
    this.shelves.transaction(() => {
      this.shelfMovies.removeMovie(id, movieId);
      this.shelves.touch(id);
    });
    return { value: this.get(id, deviceId)! };
  }

  public reorder(id: number, movieIds: number[], deviceId?: string): ShelfResult<ShelfDetail> {
    if (!this.shelves.exists(id)) return { error: 'shelf-not-found' };
    const current = this.shelfMovies.listMovieIds(id);
    if (!sameIds(current, movieIds)) return { error: 'invalid-order' };
    this.shelves.transaction(() => {
      this.shelfMovies.replaceOrder(id, movieIds);
      this.shelves.touch(id);
    });
    return { value: this.get(id, deviceId)! };
  }

  public updateMovieShelves(movieId: number, shelfIds: number[], newShelfName: string | undefined, deviceId?: string): ShelfResult<Movie> {
    if (!this.movies.hasAll([movieId])) return { error: 'movie-not-found' };
    const uniqueShelfIds = unique(shelfIds);
    if (uniqueShelfIds.some((id) => !this.shelves.exists(id))) return { error: 'shelf-not-found' };
    if (newShelfName && this.shelves.nameExists(newShelfName)) return { error: 'name-conflict' };

    const currentShelfIds = this.shelfMovies.listMemberships([movieId]).get(movieId)?.map((shelf) => shelf.id) ?? [];
    const removedShelfIds = currentShelfIds.filter((id) => !uniqueShelfIds.includes(id));
    if (removedShelfIds.some((id) => this.shelfMovies.countForShelf(id) === 1)) return { error: 'last-movie' };

    const result = this.shelves.transaction(() => {
      const finalShelfIds = [...uniqueShelfIds];
      if (newShelfName) finalShelfIds.push(this.shelves.create(newShelfName).id);

      this.shelfMovies.ensureMovieShelves(movieId, finalShelfIds);
      for (const shelfId of new Set([...currentShelfIds, ...finalShelfIds])) this.shelves.touch(shelfId);
      return { value: this.library.get(movieId, deviceId)! } as const;
    });
    return result;
  }

  private summary(shelf: ShelfRecord): ShelfSummary {
    return { ...shelf, movieCount: this.shelfMovies.countForShelf(shelf.id), coverMovies: this.shelfMovies.listCoverMovies(shelf.id) };
  }

  private detail(shelf: ShelfRecord, deviceId?: string): ShelfDetail {
    const movies = this.library.listByIds(this.shelfMovies.listMovieIds(shelf.id), deviceId);
    return { ...this.summary(shelf), movies };
  }
}

function unique(ids: number[]): number[] { return [...new Set(ids)]; }
function sameIds(left: number[], right: number[]): boolean {
  return left.length === right.length && left.length === new Set(left).size && left.every((id) => right.includes(id));
}
