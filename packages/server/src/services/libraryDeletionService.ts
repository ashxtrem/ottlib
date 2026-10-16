import { unlink } from 'node:fs/promises';
import type { MovieRepository } from '../repositories/movieRepository.js';
import { isWithinRoot } from './scanner/walker.js';

export type DeleteCopyResult = { ok: true } | { ok: false; status: 403 | 404 | 409; error: string };

/**
 * Deletes one copy of a title from disk and from the library. It exists for the duplicate Compare flow, so it
 * refuses to delete the only copy: removing a title nobody else has is done in the file manager.
 */
export class LibraryDeletionService {
  public constructor(private readonly movies: MovieRepository) {}

  public async deleteCopy(id: number): Promise<DeleteCopyResult> {
    const movie = this.movies.playbackMovie(id);
    if (!movie) return { ok: false, status: 404, error: 'Movie not found' };
    if (!movie.missing && this.movies.findDuplicateIds(id).length === 0) {
      return { ok: false, status: 409, error: 'This is the only copy of the title in your library, so it was not deleted.' };
    }
    if (!isWithinRoot(movie.folderPath, movie.path)) return { ok: false, status: 403, error: 'This file is outside the library folders, so it was not deleted.' };
    try {
      await unlink(movie.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return { ok: false, status: 409, error: `The file could not be deleted (${(error as NodeJS.ErrnoException).code ?? 'unknown error'}). It may be open in another program.` };
      }
    }
    this.movies.deleteMovie(id);
    return { ok: true };
  }
}
