import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_HIDES_PER_PROFILE } from '@ottlib/shared';
import { createDatabase } from '../db/db.js';
import { HideRepository } from '../repositories/hideRepository.js';
import { ProfileRepository } from '../repositories/profileRepository.js';
import { HideService } from './hideService.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

function fixture(max?: number) {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-hides-')); directories.push(directory);
  const db = createDatabase(directory); const profiles = new ProfileRepository(db);
  const owner = profiles.getOwner()!.id; const kid = profiles.create({ name: 'Kid', color: '#17c964', pinHash: null }).id;
  const repository = new HideRepository(db);
  const backdate = (key: string, at: string) => db.prepare('UPDATE movie_hides SET created_at = ? WHERE hide_key = ?').run(at, key);
  return { db, owner, kid, backdate, hides: new HideService(repository, max) };
}

describe('HideService', () => {
  it('caps a profile at 2000 hides by default', () => {
    expect(MAX_HIDES_PER_PROFILE).toBe(2000);
    const { db, owner, hides } = fixture();
    try {
      hides.import(owner, Array.from({ length: 2005 }, (_, index) => `m:${index}`));
      expect(hides.list(owner)).toHaveLength(2000);
    } finally { db.close(); }
  });

  it('drops the oldest hides past the cap, for that profile only', () => {
    const { db, owner, kid, backdate, hides } = fixture(3);
    try {
      hides.add(kid, 'm:9');
      hides.import(owner, ['m:1', 'm:2', 'm:3']);
      backdate('m:1', '2026-01-01T00:00:00.000Z'); backdate('m:2', '2026-01-02T00:00:00.000Z'); backdate('m:3', '2026-01-03T00:00:00.000Z');
      expect(hides.add(owner, 'm:4')).toEqual(['m:4', 'm:3', 'm:2']);
      expect(hides.import(owner, ['m:3', 'm:5', 'm:5'])).toEqual(['m:5', 'm:4', 'm:3']);
      expect(hides.remove(owner, 'm:4')).toEqual(['m:5', 'm:3']);
      expect(hides.list(kid)).toEqual(['m:9']);
    } finally { db.close(); }
  });
});
