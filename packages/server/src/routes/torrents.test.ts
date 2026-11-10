import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { upgradeCandidatesSchema } from '@ottlib/shared';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-torrent-routes-')); directories.push(directory);
  mkdirSync(join(directory, 'posters'), { recursive: true });
  const db = createDatabase(directory);
  return { app: buildApp(db, directory, 0), db };
}

describe('GET /api/torrents/upgrade-candidates', () => {
  it('answers 404 while torrent search is off', async () => {
    const { app, db } = fixture();
    try {
      expect((await app.inject({ method: 'GET', url: '/api/torrents/upgrade-candidates' })).statusCode).toBe(404);
    } finally { await app.close(); db.close(); }
  });

  it('lists low-resolution and old-codec titles once torrent search is on', async () => {
    const { app, db } = fixture();
    try {
      db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
      const insert = db.prepare("INSERT INTO movies (folder_id, canonical_path, raw_filename, parsed_title, parsed_year, size, mtime_ms, last_seen_at, video_height, video_codec, media_probe_status) VALUES (1, ?, ?, ?, 2020, 1, 1, '2026-01-01T00:00:00.000Z', ?, ?, 'completed')");
      insert.run('E:/Movies/a.mkv', 'a.mkv', 'Small', 480, 'H.264');
      insert.run('E:/Movies/b.mkv', 'b.mkv', 'Fine', 1080, 'HEVC');
      insert.run('E:/Movies/c.mkv', 'c.mkv', 'Old', 1080, 'MPEG-4');
      await app.inject({ method: 'PUT', url: '/api/settings', payload: { torrentSearchEnabled: true } });

      const codecOnly = await app.inject({ method: 'GET', url: '/api/torrents/upgrade-candidates' });
      expect(codecOnly.statusCode).toBe(200);
      expect(codecOnly.json().map((item: { movie: { title: string }; reason: string }) => [item.movie.title, item.reason])).toEqual([['Old', 'codec']]);

      await app.inject({ method: 'PUT', url: '/api/settings', payload: { torrentPreferredResolution: '1080p' } });
      const both = await app.inject({ method: 'GET', url: '/api/torrents/upgrade-candidates' });
      expect(upgradeCandidatesSchema.safeParse(both.json()).success).toBe(true);
      expect(both.json().map((item: { movie: { title: string }; reason: string }) => [item.movie.title, item.reason])).toEqual([['Old', 'codec'], ['Small', 'resolution']]);
    } finally { await app.close(); db.close(); }
  });
});
