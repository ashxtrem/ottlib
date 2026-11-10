import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { upgradeCandidatesSchema } from '@ottlib/shared';
import { oldVideoCodecs } from '../config/defaults.js';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from './movieRepository.js';
import { MovieUpgradeRepository } from './movieUpgradeRepository.js';

const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-upgrade-repo-'));
  directories.push(directory);
  const db = createDatabase(directory);
  db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  const add = (title: string, probe: { height: number; codec: string; width?: number } | null) => {
    const { id } = movies.upsertScanned({ folderId: 1, path: `E:/Movies/${title}.mkv`, filename: `${title}.mkv`, title, year: 2020, size: 1, mtimeMs: 1, seenAt: '2026-01-01T00:00:00.000Z' });
    if (probe) movies.applyMediaInfo(id, { container: 'MKV', durationMs: 7_000_000, width: probe.width ?? 1920, height: probe.height, videoCodec: probe.codec, videoProfile: null, videoBitRate: null, hdrFormat: null });
    return id;
  };
  return { db, add, upgrades: new MovieUpgradeRepository(db) };
}

describe('MovieUpgradeRepository', () => {
  it('lists low-resolution and old-codec titles by title, resolution first, skipping missing and good ones', () => {
    const { db, add, upgrades } = setup();
    try {
      add('Zulu Good', { height: 1080, codec: 'HEVC' });
      add('Beta Small', { height: 480, codec: 'H.264', width: 640 });
      add('Scope Wide', { height: 800, codec: 'HEVC', width: 1920 });
      add('Alpha Xvid', { height: 1080, codec: 'MPEG-4' });
      add('Gamma Both', { height: 576, codec: 'MPEG-2', width: 720 });
      const gone = add('Delta Gone', { height: 480, codec: 'MPEG-4' });
      add('Unprobed', null);
      db.prepare('UPDATE movies SET missing = 1 WHERE id = ?').run(gone);

      const found = upgrades.listCandidates(1, { minimumHeight: 1080, oldCodecs: oldVideoCodecs, limit: 200 });
      expect(found.map((item) => [item.movie.title, item.reason])).toEqual([['Alpha Xvid', 'codec'], ['Beta Small', 'resolution'], ['Gamma Both', 'resolution']]);
      expect(upgradeCandidatesSchema.safeParse(found).success).toBe(true);
    } finally { db.close(); }
  });

  it('applies only the codec reason without a preferred resolution, and honours the limit', () => {
    const { db, add, upgrades } = setup();
    try {
      add('A Small', { height: 480, codec: 'H.264', width: 640 });
      add('B Wmv', { height: 480, codec: 'WMV3', width: 640 });
      add('C Vc1', { height: 1080, codec: 'VC1' });
      expect(upgrades.listCandidates(1, { minimumHeight: null, oldCodecs: oldVideoCodecs, limit: 200 }).map((item) => [item.movie.title, item.reason]))
        .toEqual([['B Wmv', 'codec'], ['C Vc1', 'codec']]);
      expect(upgrades.listCandidates(1, { minimumHeight: 1080, oldCodecs: oldVideoCodecs, limit: 1 })).toHaveLength(1);
    } finally { db.close(); }
  });
});
