import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../../db/db.js';
import { AutoSkipRepository } from '../../repositories/autoSkipRepository.js';
import { MovieRepository } from '../../repositories/movieRepository.js';
import { CreditsResolver } from './creditsResolver.js';

const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

const minutes = (value: number) => value * 60_000;

function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-credits-resolver-'));
  directories.push(directory);
  const db = createDatabase(directory);
  db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Media');
  db.prepare("INSERT INTO profiles (name, color, is_owner, created_at) VALUES ('Kids', '#17c964', 0, '2026-01-01')").run();
  const movies = new MovieRepository(db); const autoSkip = new AutoSkipRepository(db);
  let next = 0;
  const add = (options: { tv?: { providerId: string; episode: number }; mediaType?: 'movie' | null; durationMs?: number }) => {
    next += 1;
    const { id } = movies.upsertScanned({ folderId: 1, path: `E:/Media/${next}.mkv`, filename: `${next}.mkv`, title: `Title ${next}`, year: 2024, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
    if (options.tv) {
      movies.applyMetadata(id, { source: 'tmdb', providerId: options.tv.providerId, mediaType: 'tv', season: 1, episode: options.tv.episode, title: `Show E${options.tv.episode}`, year: 2024, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: null, runtime: null, imdbId: null });
    } else if (options.mediaType === 'movie') {
      movies.applyMetadata(id, { source: 'tmdb', providerId: `m${next}`, mediaType: 'movie', title: `Movie ${next}`, year: 2024, overview: null, posterFile: null, backdropFile: null, genres: [], cast: [], rating: null, runtime: null, imdbId: null });
    }
    if (options.durationMs !== undefined) movies.applyMediaInfo(id, { container: 'MKV', durationMs: options.durationMs, width: 1920, height: 1080, videoCodec: 'H264', videoProfile: null, videoBitRate: null, hdrFormat: null });
    return id;
  };
  return { db, movies, autoSkip, resolver: new CreditsResolver(movies, autoSkip), add };
}

describe('CreditsResolver credits', () => {
  it('prefers the mark over the chapter, and a chapter over the series', () => {
    const { db, movies, resolver, add } = setup();
    try {
      const sibling = add({ tv: { providerId: 's', episode: 1 }, durationMs: minutes(45) });
      movies.applyCreditsChapter(sibling, minutes(43));
      const episode = add({ tv: { providerId: 's', episode: 2 }, durationMs: minutes(46) });
      expect(resolver.credits(episode)).toEqual({ startMs: minutes(44), source: 'series' });
      movies.applyCreditsChapter(episode, minutes(42));
      expect(resolver.credits(episode)).toEqual({ startMs: minutes(42), source: 'chapter' });
      movies.setCreditsMark(episode, minutes(41));
      expect(resolver.credits(episode)).toEqual({ startMs: minutes(41), source: 'mark' });
      movies.setCreditsMark(episode, null);
      expect(resolver.credits(episode)).toEqual({ startMs: minutes(42), source: 'chapter' });
    } finally { db.close(); }
  });

  it('learns only from siblings with a mark or chapter, picking the closest duration', () => {
    const { db, movies, resolver, add } = setup();
    try {
      const far = add({ tv: { providerId: 's', episode: 1 }, durationMs: minutes(44) });
      movies.setCreditsMark(far, minutes(44) - 30_000); // 30 s of credits, 60 s away
      const close = add({ tv: { providerId: 's', episode: 2 }, durationMs: minutes(45) - 10_000 });
      movies.applyCreditsChapter(close, minutes(45) - 10_000 - 90_000); // 90 s of credits, 10 s away
      const learnedOnly = add({ tv: { providerId: 's', episode: 3 }, durationMs: minutes(45) }); // no mark or chapter: never a source
      const otherShow = add({ tv: { providerId: 'other', episode: 1 }, durationMs: minutes(45) });
      movies.applyCreditsChapter(otherShow, minutes(40));
      const episode = add({ tv: { providerId: 's', episode: 4 }, durationMs: minutes(45) });
      expect(resolver.credits(episode)).toEqual({ startMs: minutes(45) - 90_000, source: 'series' });
      expect(resolver.credits(learnedOnly)).toEqual({ startMs: minutes(45) - 90_000, source: 'series' });
      // The learned episode is not a source for others: with the chapter sibling gone, only the mark sibling remains.
      movies.applyCreditsChapter(close, null);
      expect(resolver.credits(episode)).toEqual({ startMs: minutes(45) - 30_000, source: 'series' });
    } finally { db.close(); }
  });

  it('applies series learning only within 120 s of duration', () => {
    const { db, movies, resolver, add } = setup();
    try {
      const sibling = add({ tv: { providerId: 's', episode: 1 }, durationMs: minutes(45) });
      movies.applyCreditsChapter(sibling, minutes(43));
      const within = add({ tv: { providerId: 's', episode: 2 }, durationMs: minutes(47) });
      const beyond = add({ tv: { providerId: 's', episode: 3 }, durationMs: minutes(47) + 1 });
      expect(resolver.credits(within)).toEqual({ startMs: minutes(45), source: 'series' });
      expect(resolver.credits(beyond)).toBeNull();
    } finally { db.close(); }
  });

  it('never learns for movies, titles without a duration, or unknown ids', () => {
    const { db, movies, resolver, add } = setup();
    try {
      const sibling = add({ tv: { providerId: 's', episode: 1 }, durationMs: minutes(45) });
      movies.applyCreditsChapter(sibling, minutes(43));
      expect(resolver.credits(add({ tv: { providerId: 's', episode: 2 } }))).toBeNull();
      expect(resolver.credits(add({ mediaType: 'movie', durationMs: minutes(45) }))).toBeNull();
      expect(resolver.credits(999)).toBeNull();
    } finally { db.close(); }
  });
});

describe('CreditsResolver auto-skip', () => {
  it('uses the title override, then the profile default, then the server default (tv on, movie off)', () => {
    const { db, autoSkip, resolver, add } = setup();
    try {
      const episode = add({ tv: { providerId: 's', episode: 1 }, durationMs: minutes(45) });
      const otherEpisode = add({ tv: { providerId: 's', episode: 2 }, durationMs: minutes(45) });
      const movie = add({ mediaType: 'movie', durationMs: minutes(120) });
      const untyped = add({ durationMs: minutes(90) });
      expect([resolver.autoSkip(episode, 1), resolver.autoSkip(movie, 1), resolver.autoSkip(untyped, 1)]).toEqual([true, false, false]);
      expect(resolver.defaults(1)).toEqual({ movie: false, tv: true });

      autoSkip.set(1, 'default:movie', true); autoSkip.set(1, 'default:tv', false);
      expect([resolver.autoSkip(episode, 1), resolver.autoSkip(movie, 1), resolver.autoSkip(untyped, 1)]).toEqual([false, true, true]);

      autoSkip.set(1, `movie:${movie}`, false); autoSkip.set(1, 'tv:tmdb:s', true);
      expect([resolver.autoSkip(episode, 1), resolver.autoSkip(otherEpisode, 1), resolver.autoSkip(movie, 1), resolver.autoSkip(untyped, 1)]).toEqual([true, true, false, true]);
      // Another profile sees none of it.
      expect([resolver.autoSkip(episode, 2), resolver.autoSkip(movie, 2)]).toEqual([true, false]);
    } finally { db.close(); }
  });
});
