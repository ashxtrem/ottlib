import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShelfDetail } from '@ottlib/shared';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { ShelfMovieRepository } from '../repositories/shelfMovieRepository.js';
import { ShelfRepository } from '../repositories/shelfRepository.js';
import { MediaTrackRepository } from '../repositories/mediaTrackRepository.js';
import { LibraryService } from './libraryService.js';
import { ShelfService, type ShelfResult } from './shelfService.js';

const directories: string[] = [];

function fixture(): { movies: MovieRepository; shelves: ShelfService; close: () => void } {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-shelves-')); directories.push(directory);
  const db = createDatabase(directory); db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  ['Iron Man', 'Avengers', 'The Batman'].forEach((title, index) => {
    movies.upsertScanned({ folderId: 1, path: `E:/Movies/${index}.mkv`, filename: `${index}.mkv`, title, year: 2008 + index, size: 1, mtimeMs: index + 1, seenAt: '2026-01-01T00:00:00.000Z' });
  });
  const memberships = new ShelfMovieRepository(db); const records = new ShelfRepository(db); const library = new LibraryService(movies, memberships, new MediaTrackRepository(db));
  return { movies, shelves: new ShelfService(records, memberships, movies, library), close: () => db.close() };
}

function value<T>(result: ShelfResult<T>): T {
  if (!('value' in result)) throw new Error(`Expected success, received ${result.error}`);
  return result.value;
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('ShelfService', () => {
  it('creates unique shelves, keeps missing titles, and retains manual order', () => {
    const { movies, shelves, close } = fixture();
    try {
      const marvel = value(shelves.create('Marvel', [1, 2]));
      expect(shelves.create('marvel', [1])).toEqual({ error: 'name-conflict' });
      value(shelves.reorder(marvel.id, [2, 1]));
      movies.markMissingNotSeen(1, '2026-02-01T00:00:00.000Z');
      const detail = shelves.get(marvel.id) as ShelfDetail;
      expect(detail.movies.map((movie) => movie.id)).toEqual([2, 1]);
      expect(detail.movies.every((movie) => movie.missing)).toBe(true);
      expect(detail.coverMovies).toHaveLength(2);
    } finally { close(); }
  });

  it('updates memberships atomically and does not delete movie records with a shelf', () => {
    const { movies, shelves, close } = fixture();
    try {
      const marvel = value(shelves.create('Marvel', [1, 2]));
      const dc = value(shelves.create('DC', [3]));
      const updated = value(shelves.updateMovieShelves(1, [dc.id], 'Favorites'));
      expect(updated.shelves.map((shelf) => shelf.name).sort()).toEqual(['DC', 'Favorites']);
      expect(shelves.get(marvel.id)?.movieCount).toBe(1);
      expect(shelves.remove(dc.id)).toEqual({ value: undefined });
      expect(movies.get(3)).toBeDefined();
    } finally { close(); }
  });

  it('allows shelves to be empty', () => {
    const { shelves, close } = fixture();
    try {
      const marvel = value(shelves.create('Marvel', [1]));
      const empty = value(shelves.create('Empty', []));
      const dc = value(shelves.create('DC', [2]));
      value(shelves.removeMovie(marvel.id, 1));
      value(shelves.updateMovieShelves(2, [], undefined));
      expect(shelves.get(marvel.id)).toMatchObject({ movieCount: 0, movies: [] });
      expect(shelves.get(empty.id)).toMatchObject({ movieCount: 0, movies: [] });
      expect(shelves.get(dc.id)).toMatchObject({ movieCount: 0, movies: [] });
    } finally { close(); }
  });
});
