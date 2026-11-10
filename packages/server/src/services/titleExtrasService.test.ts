import type Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../db/db.js';
import type { MovieMetadata } from '../providers/metadata/MetadataProvider.js';
import { RatingsLimitReachedError, type RatingsProvider } from '../providers/metadata/RatingsProvider.js';
import { createRatingsProviders } from '../providers/metadata/ratingsProviders.js';
import { MovieExtrasRepository } from '../repositories/movieExtrasRepository.js';
import type { SettingRepository } from '../repositories/settingRepository.js';
import type { PosterCacheService } from './posterCacheService.js';
import { newRatingsRun, ratingsRefreshDays, TitleExtrasService } from './titleExtrasService.js';

vi.mock('../providers/metadata/ratingsProviders.js', () => ({ createRatingsProviders: vi.fn(() => []) }));

const open: Array<{ db: Database.Database; dir: string }> = [];
afterEach(() => open.splice(0).forEach(({ db, dir }) => { db.close(); rmSync(dir, { force: true, recursive: true }); }));
beforeEach(() => vi.mocked(createRatingsProviders).mockReturnValue([]));

const show = (extra: Partial<MovieMetadata> = {}): MovieMetadata => ({
  providerId: '1', title: 'A', year: 2020, overview: null, posterUrl: null, backdropUrl: null, genres: [], cast: [], rating: null, runtime: null, imdbId: 'tt0000001', ...extra
});

function subject(downloads: (url: string) => string | null = (url) => url.split('/').pop() ?? null) {
  const dir = mkdtempSync(join(tmpdir(), 'ottlib-title-extras-')); const db = createDatabase(dir); open.push({ db, dir });
  db.prepare("INSERT INTO folders (path) VALUES ('E:/Movies')").run();
  db.prepare("INSERT INTO movies (folder_id, canonical_path, raw_filename, parsed_title, size, mtime_ms, last_seen_at, metadata_status) VALUES (1, 'E:/Movies/a.mkv', 'a.mkv', 'A', 1, 1, 'x', 'matched')").run();
  const extras = new MovieExtrasRepository(db);
  const cache = { cache: vi.fn(async (url: string) => { const file = downloads(url); if (!file) throw new Error('download failed'); return file; }) } as unknown as PosterCacheService;
  const settings = { get: () => ({ omdbApiKey: 'k' }) } as unknown as SettingRepository;
  const log = vi.fn();
  return { db, extras, log, service: new TitleExtrasService(extras, cache, settings, log) };
}

const full = show({
  castMembers: [{ name: 'Ann', photoUrl: 'https://img/ann.jpg' }], logoUrl: 'https://img/logo.png', collection: { id: 9, name: 'Saga' }, trailerKey: 'yt1'
});

describe('TitleExtrasService.save', () => {
  it('stores cast photos, logo, collection and trailer', async () => {
    const { extras, service } = subject();
    await service.save(1, 'tmdb', full, newRatingsRun());
    expect(extras.extrasFor(1)).toMatchObject({
      castMembers: [{ name: 'Ann', photoUrl: '/media/people/ann.jpg' }], logoFile: 'logo.png', collection: { id: 9, name: 'Saga' }, trailerKey: 'yt1'
    });
  });

  it('keeps stored extras when the new metadata lacks them', async () => {
    const { extras, service } = subject();
    await service.save(1, 'tmdb', full, newRatingsRun());
    await service.save(1, 'omdb', show(), newRatingsRun());
    expect(extras.extrasFor(1)).toMatchObject({
      castMembers: [{ name: 'Ann', photoUrl: '/media/people/ann.jpg' }], logoFile: 'logo.png', collection: { id: 9, name: 'Saga' }, trailerKey: 'yt1'
    });
  });

  it('keeps the stored logo and photo when their download fails', async () => {
    let online = true;
    const { extras, service } = subject((url) => online ? url.split('/').pop() ?? null : null);
    await service.save(1, 'tmdb', full, newRatingsRun());
    online = false;
    await service.save(1, 'tmdb', full, newRatingsRun());
    expect(extras.extrasFor(1)).toMatchObject({ castMembers: [{ name: 'Ann', photoUrl: '/media/people/ann.jpg' }], logoFile: 'logo.png' });
  });

  it('replaces everything when the title changed', async () => {
    const { extras, service } = subject();
    await service.save(1, 'tmdb', full, newRatingsRun());
    await service.save(1, 'tmdb', show({ providerId: '2' }), newRatingsRun(), false);
    expect(extras.extrasFor(1)).toMatchObject({ castMembers: [], logoFile: null, collection: null, trailerKey: null });
  });
});

describe('TitleExtrasService ratings', () => {
  const provider = (getRatings: RatingsProvider['getRatings']): RatingsProvider => ({ name: 'omdb', getRatings });

  it('logs and backs off after a non-quota error instead of asking on every save', async () => {
    const { extras, log, service } = subject();
    const getRatings = vi.fn(async () => { throw new Error('Incorrect IMDb ID'); });
    vi.mocked(createRatingsProviders).mockReturnValue([provider(getRatings)]);
    await service.save(1, 'tmdb', show(), newRatingsRun());
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Incorrect IMDb ID'));
    expect(extras.ratingsDue(1, ratingsRefreshDays)).toBe(false);
    await service.save(1, 'tmdb', show(), newRatingsRun());
    expect(getRatings).toHaveBeenCalledTimes(1);
    expect(extras.ratingsDue(1, ratingsRefreshDays, new Date(Date.now() + 2 * 24 * 60 * 60 * 1000))).toBe(true);
  });

  it('stores ratings and stops the run on a used-up quota without stamping', async () => {
    const { extras, service } = subject();
    vi.mocked(createRatingsProviders).mockReturnValue([provider(async () => [{ source: 'imdb', value: 7.5, max: 10 }])]);
    await service.save(1, 'tmdb', show(), newRatingsRun());
    expect(extras.extrasFor(1)?.ratings).toEqual([{ source: 'imdb', value: 7.5, max: 10 }]);

    const limited = subject(); const run = newRatingsRun();
    vi.mocked(createRatingsProviders).mockReturnValue([provider(async () => { throw new RatingsLimitReachedError('omdb', 'daily limit'); })]);
    await limited.service.save(1, 'tmdb', show(), run);
    expect(run.limitReached).toBe(true);
    expect(limited.extras.ratingsDue(1, ratingsRefreshDays)).toBe(true);
  });
});
