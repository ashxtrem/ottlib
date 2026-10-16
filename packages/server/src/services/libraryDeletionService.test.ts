import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { LibraryDeletionService } from './libraryDeletionService.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

function library(copies: string[]) {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-delete-')); directories.push(directory);
  const media = join(directory, 'media'); mkdirSync(media, { recursive: true });
  const db = createDatabase(join(directory, 'data')); db.prepare('INSERT INTO folders (path) VALUES (?)').run(media);
  const movies = new MovieRepository(db);
  const paths = copies.map((name, index) => {
    const path = join(media, name); writeFileSync(path, 'video');
    movies.upsertScanned({ folderId: 1, path, filename: name, title: 'Arrival', year: 2016, size: 5, mtimeMs: index + 1, seenAt: '2026-01-01T00:00:00.000Z' });
    movies.applyMetadata(index + 1, { source: 'tmdb', providerId: '329865', mediaType: 'movie', title: 'Arrival', year: 2016, overview: null, posterFile: null, backdropFile: null, genres: ['Drama'], cast: [], rating: 7.9, runtime: 116, imdbId: 'tt2543164' });
    return path;
  });
  return { movies, db, paths, directory, service: new LibraryDeletionService(movies) };
}

describe('LibraryDeletionService', () => {
  it('deletes the file and the title when another copy remains', async () => {
    const { movies, db, paths, service } = library(['Arrival.720p.mkv', 'Arrival.2160p.mkv']);
    try {
      expect(await service.deleteCopy(1)).toEqual({ ok: true });
      expect(existsSync(paths[0])).toBe(false);
      expect(existsSync(paths[1])).toBe(true);
      expect(movies.get(1)).toBeUndefined();
      expect(movies.get(2)).toBeDefined();
      expect(movies.findDuplicateIds(2)).toEqual([]);
    } finally { db.close(); }
  });

  it('refuses to delete the only copy', async () => {
    const { movies, db, paths, service } = library(['Arrival.2160p.mkv']);
    try {
      expect(await service.deleteCopy(1)).toMatchObject({ ok: false, status: 409 });
      expect(existsSync(paths[0])).toBe(true);
      expect(movies.get(1)).toBeDefined();
    } finally { db.close(); }
  });

  it('still removes the title when its file is already gone', async () => {
    const { movies, db, paths, service } = library(['Arrival.720p.mkv', 'Arrival.2160p.mkv']);
    try {
      rmSync(paths[0]);
      expect(await service.deleteCopy(1)).toEqual({ ok: true });
      expect(movies.get(1)).toBeUndefined();
    } finally { db.close(); }
  });

  it('refuses a file outside its library folder', async () => {
    const { movies, db, paths, service } = library(['Arrival.720p.mkv', 'Arrival.2160p.mkv']);
    try {
      db.prepare('UPDATE movies SET canonical_path = ? WHERE id = 1').run(join(paths[0], '..', '..', 'outside.mkv'));
      expect(await service.deleteCopy(1)).toMatchObject({ ok: false, status: 403 });
      expect(movies.get(1)).toBeDefined();
    } finally { db.close(); }
  });

  it('reports an unknown title', async () => {
    const { db, service } = library(['Arrival.2160p.mkv']);
    try { expect(await service.deleteCopy(99)).toMatchObject({ ok: false, status: 404 }); } finally { db.close(); }
  });

  it('is served as DELETE /api/movies/:id/file', async () => {
    const { db, paths, directory } = library(['Arrival.720p.mkv', 'Arrival.2160p.mkv']);
    const app = buildApp(db, join(directory, 'data'), 8081);
    try {
      expect((await app.inject({ method: 'DELETE', url: '/api/movies/1/file' })).statusCode).toBe(204);
      expect(existsSync(paths[0])).toBe(false);
      const refused = await app.inject({ method: 'DELETE', url: '/api/movies/2/file' });
      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toEqual({ error: expect.stringContaining('only copy') });
      expect(existsSync(paths[1])).toBe(true);
      expect((await app.inject({ method: 'DELETE', url: '/api/movies/99/file' })).statusCode).toBe(404);
    } finally { await app.close(); db.close(); }
  });
});
