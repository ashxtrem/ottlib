import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from './movieRepository.js';
import { PlaybackHistoryRepository } from './playbackHistoryRepository.js';
import { ProfileRepository } from './profileRepository.js';

const directories: string[] = [];
const device = '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11';
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-history-repo-')); directories.push(directory);
  const db = createDatabase(directory); db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  [1, 2].forEach((id) => movies.upsertScanned({ folderId: 1, path: `E:/Movies/${id}.mkv`, filename: `${id}.mkv`, title: `Movie ${id}`, year: 2024, size: 1, mtimeMs: id, seenAt: '2026-01-01T00:00:00.000Z' }));
  const profiles = new ProfileRepository(db);
  return { db, history: new PlaybackHistoryRepository(db), owner: profiles.getOwner()!.id, kid: profiles.create({ name: 'Kid', color: '#fff', pinHash: null }).id };
}
const backdate = (db: ReturnType<typeof fixture>['db'], id: number, startedAt: string) => db.prepare('UPDATE playback_history SET started_at = ? WHERE id = ?').run(startedAt, id);

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('PlaybackHistoryRepository', () => {
  it('starts a session and finishes it with the end position', () => {
    const { db, history, owner } = fixture();
    try {
      const id = history.start({ profileId: owner, movieId: 1, deviceId: device, method: 'm3u', startPositionMs: 5_000 });
      expect(history.latestOpen(owner, 1, '2000-01-01T00:00:00.000Z')).toMatchObject({ id, deviceId: device, method: 'm3u', startPositionMs: 5_000, endedAt: null, endPositionMs: null, completed: false });
      history.finish(id, { endPositionMs: 90_000, endedAt: '2030-01-01T00:00:00.000Z', completed: true });
      expect(history.latestOpen(owner, 1, '2000-01-01T00:00:00.000Z')).toBeNull();
      expect(db.prepare('SELECT end_position_ms AS e, ended_at AS a, completed AS c FROM playback_history WHERE id = ?').get(id)).toEqual({ e: 90_000, a: '2030-01-01T00:00:00.000Z', c: 1 });
    } finally { db.close(); }
  });

  it('latestOpen respects the time window, the profile, the title and picks the newest open session', () => {
    const { db, history, owner, kid } = fixture();
    try {
      const old = history.start({ profileId: owner, movieId: 1, deviceId: null, method: 'intent', startPositionMs: 0 });
      const recent = history.start({ profileId: owner, movieId: 1, deviceId: null, method: 'android_app', startPositionMs: 0 });
      history.start({ profileId: kid, movieId: 1, deviceId: null, method: 'm3u', startPositionMs: 0 });
      history.start({ profileId: owner, movieId: 2, deviceId: null, method: 'm3u', startPositionMs: 0 });
      backdate(db, old, '2026-01-01T00:00:00.000Z');
      expect(history.latestOpen(owner, 1, '2025-01-01T00:00:00.000Z')?.id).toBe(recent);
      backdate(db, recent, '2026-01-02T00:00:00.000Z');
      expect(history.latestOpen(owner, 1, '2025-01-01T00:00:00.000Z')?.id).toBe(recent);
      expect(history.latestOpen(owner, 1, '2026-01-01T12:00:00.000Z')?.id).toBe(recent);
      expect(history.latestOpen(owner, 1, '2026-01-03T00:00:00.000Z')).toBeNull();
      history.finish(recent, { endPositionMs: 1, endedAt: '2026-01-02T01:00:00.000Z', completed: false });
      expect(history.latestOpen(owner, 1, '2025-01-01T00:00:00.000Z')?.id).toBe(old);
    } finally { db.close(); }
  });

  it('counts plays and reports the last start per profile and title', () => {
    const { db, history, owner, kid } = fixture();
    try {
      expect(history.countFor(owner, 1)).toBe(0);
      expect(history.lastPlayedAt(owner, 1)).toBeNull();
      const first = history.start({ profileId: owner, movieId: 1, deviceId: null, method: 'm3u', startPositionMs: 0 });
      const second = history.start({ profileId: owner, movieId: 1, deviceId: null, method: 'm3u', startPositionMs: 0 });
      history.start({ profileId: kid, movieId: 1, deviceId: null, method: 'm3u', startPositionMs: 0 });
      backdate(db, first, '2026-01-01T00:00:00.000Z'); backdate(db, second, '2026-02-01T00:00:00.000Z');
      expect(history.countFor(owner, 1)).toBe(2);
      expect(history.countFor(kid, 1)).toBe(1);
      expect(history.countFor(owner, 2)).toBe(0);
      expect(history.lastPlayedAt(owner, 1)).toBe('2026-02-01T00:00:00.000Z');
    } finally { db.close(); }
  });
});
