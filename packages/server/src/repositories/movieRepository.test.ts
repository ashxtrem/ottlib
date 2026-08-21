import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from './movieRepository.js';

const temporaryDirectories: string[] = [];

function createRepository(): { repository: MovieRepository; close: () => void } {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-movies-'));
  temporaryDirectories.push(directory);
  const db = createDatabase(directory);
  db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const repository = new MovieRepository(db);
  repository.upsertScanned({ folderId: 1, path: 'E:/Movies/example.mkv', filename: 'example.mkv', title: 'Example', year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  repository.applyMetadata(1, { source: 'tmdb', providerId: '1', imdbId: 'tt1234567', title: 'Example', year: 2024, overview: null, posterFile: null, backdropFile: null, genres: ['Drama'], cast: ['Asha Patel'], rating: 8.4, runtime: 120 });
  return { repository, close: () => db.close() };
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true }));
});

describe('MovieRepository filters', () => {
  it('filters by genre, actor, rating, title, and IMDb ID', () => {
    const { repository, close } = createRepository();
    try {
      expect(repository.list(undefined, { genre: 'drama' })).toHaveLength(1);
      expect(repository.list(undefined, { actor: 'asha' })).toHaveLength(1);
      expect(repository.list(undefined, { minRating: 8.5 })).toHaveLength(0);
      expect(repository.list(undefined, { minRating: 8 })).toMatchObject([{ imdbId: 'tt1234567' }]);
      expect(repository.list(undefined, { search: 'tt1234567' })).toHaveLength(1);
      expect(repository.list(undefined, { search: 'https://www.imdb.com/title/tt1234567/' })).toHaveLength(1);
      expect(repository.listFilterOptions()).toEqual({ genres: ['Drama'], actors: ['Asha Patel'] });
    } finally {
      close();
    }
  });

  it('returns media details only after a successful probe', () => {
    const { repository, close } = createRepository();
    try {
      expect(repository.get(1)?.mediaInfo).toBeNull();
      repository.applyMediaInfo(1, { container: 'MKV', durationMs: 6_000, width: 1920, height: 1080, videoCodec: 'H.264', videoProfile: 'High', videoBitRate: 3_000_000, hdrFormat: null });
      expect(repository.get(1)?.mediaInfo).toMatchObject({ container: 'MKV', width: 1920, height: 1080, videoCodec: 'H.264', tracks: [] });
    } finally {
      close();
    }
  });
});
