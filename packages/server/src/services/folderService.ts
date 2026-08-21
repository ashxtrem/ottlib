import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FolderRepository } from '../repositories/folderRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';

export class FolderService {
  public constructor(private readonly folders: FolderRepository, private readonly movies: MovieRepository) {}
  public list() { return this.folders.list(); }
  public async add(path: string) {
    const canonicalPath = resolve(path); const details = await stat(canonicalPath);
    if (!details.isDirectory()) throw new Error('Scan root must be an existing directory');
    return this.folders.create(canonicalPath);
  }
  public remove(id: number): void { this.movies.markFolderMissing(id); this.folders.remove(id); }
}
