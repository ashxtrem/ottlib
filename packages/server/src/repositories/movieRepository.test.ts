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
  it('reports whether a scanned movie was inserted or updated', () => {
    const { repository, close } = createRepository();
    try {
      const movie = { folderId: 1, path: 'E:/Movies/new.mkv', filename: 'new.mkv', title: 'New', year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' };
      expect(repository.upsertScanned(movie).inserted).toBe(true);
      expect(repository.upsertScanned(movie).inserted).toBe(false);
    } finally {
      close();
    }
  });

  it('keeps accepted metadata titles when a file is rescanned', () => {
    const { repository, close } = createRepository();
    try {
      repository.applyMetadata(1, { source: 'tmdb', providerId: '8579674', imdbId: 'tt8579674', title: '1917', year: 2019, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: null, runtime: null });

      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/example.mkv', filename: 'new vdos (1917).mkv', title: 'new vdos', year: 1917, size: 1, mtimeMs: 1, seenAt: '2026-01-02T00:00:00.000Z' });

      expect(repository.get(1)).toMatchObject({ title: '1917', year: 2019, rawFilename: 'new vdos (1917).mkv', imdbId: 'tt8579674', metadataStatus: 'matched' });
    } finally {
      close();
    }
  });

  it('falls back to the filename title when a changed file cannot be rematched', () => {
    const { repository, close } = createRepository();
    try {
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/example.mkv', filename: 'unmatched file (2025).mkv', title: 'Unmatched file', year: 2025, size: 2, mtimeMs: 2, seenAt: '2026-01-02T00:00:00.000Z' });
      repository.markUnmatched(1);

      expect(repository.get(1)).toMatchObject({ title: 'Unmatched file', year: 2025, metadataStatus: 'unmatched' });
    } finally {
      close();
    }
  });

  it('filters by genre, actor, rating, title, and IMDb ID', () => {
    const { repository, close } = createRepository();
    try {
      repository.applyMetadata(1, { source: 'tmdb', providerId: '1', mediaType: 'movie', imdbId: 'tt1234567', title: 'Example', year: 2024, overview: null, posterFile: null, backdropFile: null, genres: ['Drama'], cast: ['Asha Patel'], rating: 8.4, runtime: 120 });
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/show.mkv', filename: 'show.mkv', title: 'Show', year: 2024, size: 2, mtimeMs: 2, seenAt: '2026-01-01T00:00:00.000Z' });
      repository.applyMetadata(2, { source: 'tmdb', providerId: '2', mediaType: 'tv', imdbId: 'tt7654321', title: 'Show', year: 2024, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: null, runtime: null });
      expect(repository.list(undefined, { genre: 'drama' })).toHaveLength(1);
      expect(repository.list(undefined, { actor: 'asha' })).toHaveLength(1);
      expect(repository.list(undefined, { minRating: 8.5 })).toHaveLength(0);
      expect(repository.list(undefined, { minRating: 8 })).toMatchObject([{ imdbId: 'tt1234567' }]);
      expect(repository.list(undefined, { search: 'tt1234567' })).toHaveLength(1);
      expect(repository.list(undefined, { search: 'https://www.imdb.com/title/tt1234567/' })).toHaveLength(1);
      expect(repository.list(undefined, { mediaType: 'movie' })).toHaveLength(1);
      expect(repository.list(undefined, { mediaType: 'tv' })).toHaveLength(1);
      expect(repository.listFilterOptions()).toEqual({ genres: ['Drama'], actors: ['Asha Patel'], resolutions: [], audioLanguages: [] });
    } finally {
      close();
    }
  });

  it('filters the library to titles waiting for match review', () => {
    const { repository, close } = createRepository();
    try {
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/unmatched.mkv', filename: 'unmatched.mkv', title: 'Unmatched', year: null, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
      repository.saveCandidates(2, [{ provider: 'tmdb', providerId: '2', title: 'Matched title', year: 2024, score: 0.6, mediaType: 'movie' }]);
      expect(repository.list(undefined, { needsReview: true })).toMatchObject([{ id: 2, title: 'Matched title', year: 2024, metadataStatus: 'suggested' }]);
    } finally {
      close();
    }
  });

  it('keeps an explicit title override when a suggested match is saved', () => {
    const { repository, close } = createRepository();
    try {
      repository.updateTitleOverride(1, 'My custom title');
      repository.saveCandidates(1, [{ provider: 'tmdb', providerId: '2', title: 'Provider title', year: 2024, score: 0.6, mediaType: 'movie' }]);

      expect(repository.get(1)).toMatchObject({ title: 'My custom title', year: 2024, metadataStatus: 'suggested' });
    } finally {
      close();
    }
  });

  it('persists an episode number carried by a match candidate', () => {
    const { repository, close } = createRepository();
    try {
      repository.saveCandidates(1, [{ provider: 'tmdb', providerId: '2', title: 'Example', year: 2024, score: 1, mediaType: 'tv', season: 3, episode: 7 }]);

      expect(repository.getCandidates(1)).toMatchObject([{ mediaType: 'tv', season: 3, episode: 7 }]);
      expect(repository.getCandidate(1, repository.getCandidates(1)[0].id)).toMatchObject({ mediaType: 'tv', season: 3, episode: 7 });
    } finally {
      close();
    }
  });

  it('returns the saved provider identity for direct metadata refreshes', () => {
    const { repository, close } = createRepository();
    try {
      repository.applyMetadata(1, { source: 'tmdb', providerId: '979', mediaType: 'movie', imdbId: 'tt0290673', title: 'Irreversible', year: 2002, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: null, runtime: null });

      expect(repository.listMetadataRefreshTargets([1])).toMatchObject([{ id: 1, metadataSource: 'tmdb', providerId: '979', mediaType: 'movie' }]);
    } finally {
      close();
    }
  });

  it('includes unavailable titles by default and filters them by availability', () => {
    const { repository, close } = createRepository();
    try {
      repository.markMissingNotSeen(1, '2026-02-02T00:00:00.000Z');
      expect(repository.listSummaries(undefined)).toMatchObject({ total: 1, items: [{ id: 1, missing: true }] });
      expect(repository.listSummaries(undefined, { availability: 'available' })).toMatchObject({ total: 0, items: [] });
      expect(repository.listSummaries(undefined, { availability: 'unavailable' })).toMatchObject({ total: 1, items: [{ id: 1, missing: true }] });
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
      expect(Object.keys(first.items[0]).sort()).toEqual(['durationMs', 'hdrFormat', 'id', 'metadataStatus', 'missing', 'posterUrl', 'resolution', 'resumePositionMs', 'shelves', 'title', 'watched', 'year']);
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

  it('finds non-missing copies by IMDb ID while excluding the anchor', () => {
    const { repository, close } = createRepository();
    try {
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/example-copy.mkv', filename: 'example-copy.mkv', title: 'Example copy', year: 2024, size: 2, mtimeMs: 2, seenAt: '2026-01-01T00:00:00.000Z' });
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/missing-copy.mkv', filename: 'missing-copy.mkv', title: 'Missing copy', year: 2024, size: 3, mtimeMs: 3, seenAt: '2026-01-01T00:00:00.000Z' });
      [2, 3].forEach((id) => repository.applyMetadata(id, { source: 'tmdb', providerId: String(id), mediaType: 'movie', imdbId: 'tt1234567', title: 'Example', year: 2024, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: null, runtime: null }));
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/example.mkv', filename: 'example.mkv', title: 'Example', year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-02-02T00:00:00.000Z' });
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/example-copy.mkv', filename: 'example-copy.mkv', title: 'Example copy', year: 2024, size: 2, mtimeMs: 2, seenAt: '2026-02-02T00:00:00.000Z' });
      repository.markMissingNotSeen(1, '2026-02-02T00:00:00.000Z');

      expect(repository.findDuplicateIds(1)).toEqual([2]);
    } finally {
      close();
    }
  });

  it('requires the same season and episode for TV copies matched by IMDb ID', () => {
    const { repository, close } = createRepository();
    try {
      const metadata = (season: number, episode: number) => ({ source: 'tmdb', providerId: '42', mediaType: 'tv' as const, season, episode, imdbId: 'tt7654321', title: 'Example Show', year: 2024, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: null, runtime: null });
      repository.applyMetadata(1, metadata(1, 1));
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/show-s01e01-copy.mkv', filename: 'show-s01e01-copy.mkv', title: 'Example Show', year: 2024, size: 2, mtimeMs: 2, seenAt: '2026-01-01T00:00:00.000Z' });
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/show-s01e02.mkv', filename: 'show-s01e02.mkv', title: 'Example Show', year: 2024, size: 3, mtimeMs: 3, seenAt: '2026-01-01T00:00:00.000Z' });
      repository.applyMetadata(2, metadata(1, 1));
      repository.applyMetadata(3, metadata(1, 2));

      expect(repository.findDuplicateIds(1)).toEqual([2]);
    } finally {
      close();
    }
  });

  it('falls back to normalized title and year when no IMDb ID is available', () => {
    const { repository, close } = createRepository();
    try {
      repository.applyMetadata(1, { source: 'tmdb', providerId: '1', mediaType: 'movie', imdbId: null, title: 'Example', year: 2024, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: null, runtime: null });
      repository.upsertScanned({ folderId: 1, path: 'E:/Movies/example-second.mkv', filename: 'example-second.mkv', title: ' example ', year: 2024, size: 2, mtimeMs: 2, seenAt: '2026-01-01T00:00:00.000Z' });

      expect(repository.findDuplicateIds(1)).toEqual([2]);
    } finally {
      close();
    }
  });
});
