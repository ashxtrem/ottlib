import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MediaTrackRepository } from './mediaTrackRepository.js';
import { MovieRepository } from './movieRepository.js';

const temporaryDirectories: string[] = [];

function createRepository(): { repository: MovieRepository; tracks: MediaTrackRepository; close: () => void } {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-movies-'));
  temporaryDirectories.push(directory);
  const db = createDatabase(directory);
  db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const repository = new MovieRepository(db);
  const tracks = new MediaTrackRepository(db);
  repository.upsertScanned({ folderId: 1, path: 'E:/Movies/example.mkv', filename: 'example.mkv', title: 'Example', year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
  repository.applyMetadata(1, { source: 'tmdb', providerId: '1', imdbId: 'tt1234567', title: 'Example', year: 2024, overview: null, posterFile: null, backdropFile: null, genres: ['Drama'], cast: ['Asha Patel'], rating: 8.4, runtime: 120 });
  return { repository, tracks, close: () => db.close() };
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
      expect(repository.listFilterOptions()).toEqual({ genres: ['Drama'], actors: ['Asha Patel'], resolutions: [], audioLanguages: [] });
    } finally {
      close();
    }
  });

  it('filters the library to titles waiting for match review', () => {
    const { repository, close } = createRepository();
    try {
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/unmatched.mkv', filename: 'unmatched.mkv', title: 'Unmatched', year: null, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
      repository.saveCandidates(2, [{ provider: 'tmdb', providerId: '2', title: 'Unmatched', year: 2024, score: 0.6, mediaType: 'movie' }]);
      expect(repository.list(undefined, { needsReview: true })).toMatchObject([{ id: 2, metadataStatus: 'suggested' }]);
    } finally {
      close();
    }
  });

  it('filters by probed quality and audio language, and exposes both filter options', () => {
    const { repository, tracks, close } = createRepository();
    try {
      repository.applyMediaInfo(1, { container: 'MKV', durationMs: 6_000, width: 3840, height: 2160, videoCodec: 'HEVC', videoProfile: 'Main 10', videoBitRate: 3_000_000, hdrFormat: 'HDR10' });
      tracks.replaceForMovie(1, [{ type: 'audio', source: 'embedded', order: 1, language: 'hin', title: null, codec: 'E-AC-3', channels: 6, channelLayout: '5.1', isDefault: true, isForced: false, isHearingImpaired: false }]);

      expect(repository.list(undefined, { quality: '4K' })).toHaveLength(1);
      expect(repository.list(undefined, { quality: '1080p' })).toHaveLength(0);
      expect(repository.list(undefined, { audioLanguage: 'hin' })).toHaveLength(1);
      expect(repository.list(undefined, { audioLanguage: 'eng' })).toHaveLength(0);
      expect(repository.listFilterOptions()).toEqual({ genres: ['Drama'], actors: ['Asha Patel'], resolutions: ['4K'], audioLanguages: ['hin'] });
    } finally {
      close();
    }
  });

  it('returns lean, cursor-paginated list summaries', () => {
    const { repository, close } = createRepository();
    try {
      ['Bravo', 'Charlie'].forEach((title, index) => repository.upsertScanned({ folderId: 1, path: `E:/Movies/${title}.mkv`, filename: `${title}.mkv`, title, year: 2024, size: 1, mtimeMs: index + 2, seenAt: '2026-01-01T00:00:00.000Z' }));
      const first = repository.listSummaries(undefined, { limit: 2 });
      const second = repository.listSummaries(undefined, { limit: 2, cursor: first.nextCursor ?? undefined });

      expect(first).toMatchObject({ total: 3, items: [{ title: 'Bravo' }, { title: 'Charlie' }] });
      expect(first.nextCursor).toEqual(expect.any(String));
      expect(second).toMatchObject({ total: 3, nextCursor: null, items: [{ title: 'Example' }] });
      expect([...first.items, ...second.items].map((movie) => movie.title)).toEqual(['Bravo', 'Charlie', 'Example']);
      expect(Object.keys(first.items[0]).sort()).toEqual(['hdrFormat', 'id', 'metadataStatus', 'posterUrl', 'resolution', 'shelves', 'title', 'watched', 'year']);
    } finally {
      close();
    }
  });

  it('sorts paginated summaries by probed resolution', () => {
    const { repository, close } = createRepository();
    try {
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/four-k.mkv', filename: 'four-k.mkv', title: 'Four K', year: 2024, size: 1, mtimeMs: 2, seenAt: '2026-01-01T00:00:00.000Z' });
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/unknown.mkv', filename: 'unknown.mkv', title: 'Unknown', year: 2024, size: 1, mtimeMs: 3, seenAt: '2026-01-01T00:00:00.000Z' });
      repository.applyMediaInfo(1, { container: 'MKV', durationMs: 6_000, width: 1920, height: 1080, videoCodec: 'H.264', videoProfile: 'High', videoBitRate: 3_000_000, hdrFormat: null });
      repository.applyMediaInfo(2, { container: 'MKV', durationMs: 6_000, width: 3840, height: 2160, videoCodec: 'HEVC', videoProfile: 'Main 10', videoBitRate: 3_000_000, hdrFormat: 'HDR10' });

      const first = repository.listSummaries(undefined, { sort: 'quality', limit: 1 });
      const second = repository.listSummaries(undefined, { sort: 'quality', limit: 1, cursor: first.nextCursor ?? undefined });
      const third = repository.listSummaries(undefined, { sort: 'quality', limit: 1, cursor: second.nextCursor ?? undefined });

      expect([first, second, third].map((page) => page.items[0]?.title)).toEqual(['Four K', 'Example', 'Unknown']);
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
