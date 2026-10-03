import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MovieRepository, type ScannedMovie } from './movieRepository.js';
import { PlaybackProgressRepository } from './playbackProgressRepository.js';
import { ShelfMovieRepository } from './shelfMovieRepository.js';
import { WatchStateRepository } from './watchStateRepository.js';

const cleanups: Array<() => void> = [];
const original: ScannedMovie = { folderId: 1, path: 'E:/Movies/example.mkv', filename: 'example.mkv', title: 'Filename title', year: 2024, size: 100, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' };
const candidate = { provider: 'tmdb', providerId: '2', title: 'New suggestion', year: 2025, score: 0.6, mediaType: 'movie' as const };
const emptyMetadata = { metadataSource: null, imdbId: null, mediaType: null, season: null, episode: null, overview: null, posterUrl: null, backdropUrl: null, genres: [], cast: [], rating: null, runtime: null };

function fixture(mediaType: 'movie' | 'tv' = 'movie') {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-metadata-'));
  const db = createDatabase(directory);
  cleanups.push(() => { db.close(); rmSync(directory, { recursive: true, force: true }); });
  db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  const metadata = { source: 'tmdb', providerId: '1', mediaType, title: 'Old provider title', year: 2023, overview: 'Old plot', posterFile: 'old.jpg', backdropFile: 'old-backdrop.jpg', genres: ['Adventure'], cast: ['Old actor'], rating: 8, runtime: 120, imdbId: 'tt1234567', season: mediaType === 'tv' ? 1 : null, episode: mediaType === 'tv' ? 1 : null };
  movies.upsertScanned(original);
  movies.applyMetadata(1, metadata);
  return { db, movies, metadata };
}

afterEach(() => cleanups.splice(0).reverse().forEach((cleanup) => cleanup()));

describe('MovieRepository metadata invalidation', () => {
  it.each([
    ['movie', { size: 101 }], ['movie', { mtimeMs: 2 }],
    ['tv', { size: 101 }], ['tv', { mtimeMs: 2 }]
  ] as const)('clears all %s metadata and candidates when a file changes (%j)', (mediaType, change) => {
    const { db, movies, metadata } = fixture(mediaType);
    movies.upsertScanned({ ...original, path: 'E:/Movies/other.mkv', filename: 'other.mkv' });
    movies.applyMetadata(2, { ...metadata, episode: mediaType === 'tv' ? 2 : null });
    expect(movies.findDuplicateIds(1)).toEqual(mediaType === 'movie' ? [2] : []);
    expect(movies.nextEpisodeId(1)).toBe(mediaType === 'tv' ? 2 : undefined);
    movies.saveCandidates(1, [candidate]);

    expect(movies.upsertScanned({ ...original, ...change, title: 'Replacement', year: 2025 })).toMatchObject({ id: 1, inserted: false, needsMatch: true, needsProbe: true });

    expect(movies.get(1)).toMatchObject({ ...emptyMetadata, title: 'Replacement', year: 2025, metadataStatus: 'pending' });
    expect(movies.metadataTarget(1)).toMatchObject({ providerId: null, metadataSource: null, imdbId: null, mediaType: null, title: 'Replacement', year: 2025 });
    expect(movies.getCandidates(1)).toEqual([]);
    expect(movies.listSummaries(undefined).items.find((item) => item.id === 1)).toMatchObject({ title: 'Replacement', year: 2025, posterUrl: null });
    expect(movies.list(undefined, { genre: 'Adventure' }).map((item) => item.id)).toEqual([2]);
    expect(movies.findDuplicateIds(1)).toEqual([]);
    expect(movies.nextEpisodeId(1)).toBeUndefined();
    expect(db.prepare('SELECT matched_at, metadata_error FROM movies WHERE id = 1').get()).toEqual({ matched_at: null, metadata_error: null });
  });

  it.each(['movie', 'tv'] as const)('preserves accepted %s metadata on an unchanged rescan', (mediaType) => {
    const { movies } = fixture(mediaType);
    const accepted = movies.get(1);
    const target = movies.metadataTarget(1);

    expect(movies.upsertScanned({ ...original, seenAt: '2026-01-02T00:00:00.000Z' })).toMatchObject({ inserted: false, needsMatch: false });

    expect(movies.get(1)).toEqual(accepted);
    expect(movies.metadataTarget(1)).toEqual(target);
  });

  it('preserves title overrides, watch state, progress and shelf membership on a changed rescan', () => {
    const { db, movies } = fixture();
    const watches = new WatchStateRepository(db);
    const progress = new PlaybackProgressRepository(db);
    const shelves = new ShelfMovieRepository(db);
    db.prepare('INSERT INTO shelves (name) VALUES (?)').run('Favorites');
    shelves.addMovies(1, [1]);
    watches.set(1, 'device-a', true);
    watches.set(1, 'device-b', false);
    progress.set(1, 'device-b', 180_000, 900_000, 1);
    const savedProgress = progress.get(1, 'device-b');
    movies.updateTitleOverride(1, 'My title');

    movies.upsertScanned({ ...original, size: 101, title: 'Replacement', year: 2025 });

    expect(movies.get(1, 'device-a')).toMatchObject({ ...emptyMetadata, title: 'My title', titleOverride: 'My title', year: 2025, watched: true });
    expect(movies.get(1, 'device-b')).toMatchObject({ watched: false, resumePositionMs: 180_000 });
    expect(progress.get(1, 'device-b')).toEqual(savedProgress);
    expect(shelves.listMovieIds(1)).toEqual([1]);
    expect(shelves.listCoverMovies(1)).toEqual([{ id: 1, title: 'My title', posterUrl: null }]);
  });

  it('clears accepted details and review candidates when explicitly resetting a match', () => {
    const { movies } = fixture('tv');
    movies.saveCandidates(1, [candidate]);

    movies.resetForRematch(1);

    expect(movies.get(1)).toMatchObject({ ...emptyMetadata, title: original.title, year: original.year, metadataStatus: 'pending' });
    expect(movies.getCandidates(1)).toEqual([]);
    expect(movies.metadataTarget(1)?.providerId).toBeNull();
  });

  it('clears every automatic field when marking an existing match unmatched', () => {
    const { movies } = fixture('tv');
    movies.saveCandidates(1, [candidate]);

    movies.markUnmatched(1);

    expect(movies.get(1)).toMatchObject({ ...emptyMetadata, title: original.title, year: original.year, metadataStatus: 'unmatched' });
    expect(movies.getCandidates(1)).toEqual([]);
    expect(movies.listFilterOptions()).toMatchObject({ genres: [], actors: [] });
  });

  it.each([null, 'Provider unavailable'])('never resurrects metadata after changed-file lookup fails (%s)', (error) => {
    const { movies } = fixture('tv');
    movies.upsertScanned({ ...original, size: 101 });

    movies.markUnmatched(1, error);
    expect(movies.get(1)).toMatchObject({ ...emptyMetadata, title: original.title, metadataStatus: error ? 'error' : 'unmatched' });

    movies.saveCandidates(1, [candidate]);
    expect(movies.get(1)).toMatchObject({ ...emptyMetadata, title: candidate.title, year: candidate.year, metadataStatus: 'suggested' });
    movies.dismissCandidates(1);
    expect(movies.get(1)).toMatchObject({ ...emptyMetadata, title: original.title, year: original.year, metadataStatus: 'unmatched' });
  });

  it('preserves accepted metadata as a unit on a transient provider error', () => {
    const { movies } = fixture('tv');
    const accepted = movies.get(1)!;

    movies.markUnmatched(1, 'Provider unavailable');

    expect(movies.get(1)).toEqual({ ...accepted, metadataStatus: 'error' });
  });

  it('rolls back the file update if candidate invalidation fails', () => {
    const { db, movies } = fixture();
    movies.saveCandidates(1, [candidate]);
    const before = movies.get(1);
    const candidates = movies.getCandidates(1);
    db.exec("CREATE TRIGGER reject_candidate_delete BEFORE DELETE ON movie_match_candidates BEGIN SELECT RAISE(ABORT, 'invalidation failed'); END");

    expect(() => movies.upsertScanned({ ...original, size: 101, title: 'Replacement' })).toThrow('invalidation failed');

    expect(movies.get(1)).toEqual(before);
    expect(movies.getCandidates(1)).toEqual(candidates);
    db.exec('DROP TRIGGER reject_candidate_delete');
    expect(movies.upsertScanned({ ...original, size: 101 }).needsMatch).toBe(true);
  });
});
