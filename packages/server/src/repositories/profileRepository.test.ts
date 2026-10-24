import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { HideRepository } from './hideRepository.js';
import { ProfileRepository } from './profileRepository.js';
import { ProfileSessionRepository } from './profileSessionRepository.js';

const directories: string[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-profile-repo-')); directories.push(directory);
  const db = createDatabase(directory);
  return { db, profiles: new ProfileRepository(db) };
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('ProfileRepository', () => {
  it('starts with the owner profile and lists, gets and counts profiles', () => {
    const { db, profiles } = fixture();
    try {
      expect(profiles.count()).toBe(1);
      const owner = profiles.getOwner()!;
      expect(owner).toMatchObject({ name: 'Home', isOwner: true, pinHash: null });
      const kid = profiles.create({ name: 'Kid', color: '#17c964', pinHash: 'hash' });
      expect(kid).toMatchObject({ name: 'Kid', color: '#17c964', pinHash: 'hash', isOwner: false });
      expect(profiles.get(kid.id)).toEqual(kid);
      expect(profiles.get(999)).toBeUndefined();
      expect(profiles.list().map((profile) => profile.name)).toEqual(['Home', 'Kid']);
      expect(profiles.count()).toBe(2);
    } finally { db.close(); }
  });

  it('updates name and color, sets and clears the PIN, and rejects duplicate names ignoring case', () => {
    const { db, profiles } = fixture();
    try {
      const kid = profiles.create({ name: 'Kid', color: '#fff', pinHash: null });
      profiles.update(kid.id, { name: 'Teen' });
      expect(profiles.get(kid.id)).toMatchObject({ name: 'Teen', color: '#fff' });
      profiles.update(kid.id, { color: '#000' });
      expect(profiles.get(kid.id)).toMatchObject({ name: 'Teen', color: '#000' });
      profiles.update(kid.id, {});
      expect(profiles.get(kid.id)).toMatchObject({ name: 'Teen', color: '#000' });
      profiles.setPinHash(kid.id, 'abc');
      expect(profiles.get(kid.id)?.pinHash).toBe('abc');
      profiles.setPinHash(kid.id, null);
      expect(profiles.get(kid.id)?.pinHash).toBeNull();
      expect(() => profiles.create({ name: 'HOME', color: '#fff', pinHash: null })).toThrow(/UNIQUE/);
    } finally { db.close(); }
  });

  it('deletes a profile along with its sessions and hides', () => {
    const { db, profiles } = fixture();
    try {
      const kid = profiles.create({ name: 'Kid', color: '#fff', pinHash: null });
      new ProfileSessionRepository(db).create('token', kid.id, null);
      new HideRepository(db).add(kid.id, 'm:1');
      profiles.delete(kid.id);
      expect(profiles.get(kid.id)).toBeUndefined();
      expect(new ProfileSessionRepository(db).find('token')).toBeUndefined();
      expect(new HideRepository(db).count(kid.id)).toBe(0);
      expect(profiles.count()).toBe(1);
    } finally { db.close(); }
  });
});
