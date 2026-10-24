import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { HideRepository } from './hideRepository.js';
import { ProfileRepository } from './profileRepository.js';

const directories: string[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-hide-repo-')); directories.push(directory);
  const db = createDatabase(directory);
  const profiles = new ProfileRepository(db);
  return { db, hides: new HideRepository(db), owner: profiles.getOwner()!.id, kid: profiles.create({ name: 'Kid', color: '#fff', pinHash: null }).id };
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('HideRepository', () => {
  it('lists newest first, ignores duplicates and keeps profiles separate', () => {
    const { db, hides, owner, kid } = fixture();
    try {
      hides.add(owner, 'm:1'); hides.add(owner, 'show:a'); hides.add(owner, 'm:1');
      hides.add(kid, 'm:9');
      expect(hides.list(owner)).toEqual(['show:a', 'm:1']);
      expect(hides.list(kid)).toEqual(['m:9']);
      expect(hides.count(owner)).toBe(2);
    } finally { db.close(); }
  });

  it('adds many keys at once, skipping ones already hidden', () => {
    const { db, hides, owner } = fixture();
    try {
      hides.add(owner, 'm:1');
      hides.addMany(owner, ['m:2', 'm:1', 'm:3', 'm:2']);
      expect(hides.count(owner)).toBe(3);
      expect(hides.list(owner)).toEqual(['m:3', 'm:2', 'm:1']);
      hides.addMany(owner, []);
      expect(hides.count(owner)).toBe(3);
    } finally { db.close(); }
  });

  it('removes a single key', () => {
    const { db, hides, owner } = fixture();
    try {
      hides.addMany(owner, ['m:1', 'm:2']);
      hides.remove(owner, 'm:1'); hides.remove(owner, 'm:404');
      expect(hides.list(owner)).toEqual(['m:2']);
    } finally { db.close(); }
  });

  it('trims to the newest N and only for that profile', () => {
    const { db, hides, owner, kid } = fixture();
    try {
      hides.addMany(owner, ['m:1', 'm:2', 'm:3', 'm:4']); hides.addMany(kid, ['m:1', 'm:2', 'm:3']);
      hides.trimTo(owner, 2);
      expect(hides.list(owner)).toEqual(['m:4', 'm:3']);
      expect(hides.count(kid)).toBe(3);
      hides.trimTo(owner, 10);
      expect(hides.count(owner)).toBe(2);
      hides.trimTo(owner, 0);
      expect(hides.count(owner)).toBe(0);
    } finally { db.close(); }
  });
});
