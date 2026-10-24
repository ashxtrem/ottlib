import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { ProfileRepository } from './profileRepository.js';
import { ProfileSessionRepository } from './profileSessionRepository.js';

const directories: string[] = [];
const device = '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11';
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-profile-session-repo-')); directories.push(directory);
  const db = createDatabase(directory);
  const profiles = new ProfileRepository(db);
  return { db, sessions: new ProfileSessionRepository(db), owner: profiles.getOwner()!.id, kid: profiles.create({ name: 'Kid', color: '#fff', pinHash: null }).id };
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('ProfileSessionRepository', () => {
  it('creates, finds and deletes a session by token hash', () => {
    const { db, sessions, owner } = fixture();
    try {
      sessions.create('hash-a', owner, device);
      sessions.create('hash-b', owner, null);
      expect(sessions.find('hash-a')).toMatchObject({ profileId: owner, deviceId: device });
      expect(sessions.find('hash-b')?.deviceId).toBeNull();
      expect(sessions.find('missing')).toBeUndefined();
      sessions.delete('hash-a');
      expect(sessions.find('hash-a')).toBeUndefined();
      expect(sessions.find('hash-b')).toBeDefined();
    } finally { db.close(); }
  });

  it('touches last-seen time', () => {
    const { db, sessions, owner } = fixture();
    try {
      sessions.create('hash-a', owner, null);
      sessions.touch('hash-a', '2030-01-01T00:00:00.000Z');
      expect(sessions.find('hash-a')?.lastSeenAt).toBe('2030-01-01T00:00:00.000Z');
    } finally { db.close(); }
  });

  it('deletes every session of one profile and leaves the others', () => {
    const { db, sessions, owner, kid } = fixture();
    try {
      sessions.create('a', kid, null); sessions.create('b', kid, device); sessions.create('c', owner, null);
      sessions.deleteForProfile(kid);
      expect(sessions.find('a')).toBeUndefined();
      expect(sessions.find('b')).toBeUndefined();
      expect(sessions.find('c')).toBeDefined();
    } finally { db.close(); }
  });
});
