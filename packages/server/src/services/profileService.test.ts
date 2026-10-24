import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { AccessPinRepository } from '../repositories/accessPinRepository.js';
import { AuthSessionRepository } from '../repositories/authSessionRepository.js';
import { ProfileRepository } from '../repositories/profileRepository.js';
import { ProfileSessionRepository } from '../repositories/profileSessionRepository.js';
import { AccessPinService } from './accessPinService.js';
import { LocalResetService } from './localResetService.js';
import { ProfilePinCheck } from './profilePinCheck.js';
import { ProfileService } from './profileService.js';
import { ProfileSessionService } from './profileSessionService.js';

const directories: string[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-profile-service-')); directories.push(directory);
  const db = createDatabase(directory);
  const records = new ProfileRepository(db); const pins = new ProfilePinCheck();
  const profiles = new ProfileService(records, pins);
  const sessions = new ProfileSessionService(records, new ProfileSessionRepository(db), pins);
  return { db, records, profiles, sessions, ownerId: records.getOwner()!.id };
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

const errorOf = (action: () => unknown) => { try { action(); } catch (error) { return error as { statusCode: number; code?: string }; } throw new Error('expected a ProfileError'); };

describe('ProfileService', () => {
  it('lets only the owner create profiles, up to the limit, with unique names', () => {
    const { db, profiles, ownerId } = fixture();
    try {
      const kid = profiles.create(ownerId, { name: 'Kid', color: '#17c964', pin: '1234' });
      expect(kid).toEqual({ id: kid.id, name: 'Kid', color: '#17c964', hasPin: true, isOwner: false });
      expect(errorOf(() => profiles.create(kid.id, { name: 'Other', color: '#17c964' }))).toMatchObject({ statusCode: 403 });
      expect(errorOf(() => profiles.create(ownerId, { name: 'kid', color: '#17c964' }))).toMatchObject({ statusCode: 409, code: 'PROFILE_NAME_TAKEN' });
      for (const name of ['A', 'B', 'C', 'D']) profiles.create(ownerId, { name, color: '#006fee' });
      expect(profiles.list()).toHaveLength(6);
      expect(errorOf(() => profiles.create(ownerId, { name: 'Seventh', color: '#006fee' }))).toMatchObject({ statusCode: 409, code: 'PROFILE_LIMIT' });
    } finally { db.close(); }
  });

  it('renames and recolors self or, for the owner, anyone', () => {
    const { db, profiles, ownerId } = fixture();
    try {
      const a = profiles.create(ownerId, { name: 'A', color: '#006fee' }); const b = profiles.create(ownerId, { name: 'B', color: '#006fee' });
      expect(profiles.update(a.id, a.id, { name: 'Anna', color: '#f31260' })).toMatchObject({ name: 'Anna', color: '#f31260' });
      expect(profiles.update(a.id, a.id, { name: 'ANNA' })).toMatchObject({ name: 'ANNA' });
      expect(errorOf(() => profiles.update(a.id, b.id, { name: 'Bee' }))).toMatchObject({ statusCode: 403 });
      expect(errorOf(() => profiles.update(a.id, a.id, { name: 'b' }))).toMatchObject({ statusCode: 409, code: 'PROFILE_NAME_TAKEN' });
      expect(profiles.update(ownerId, b.id, { name: 'Bee' })).toMatchObject({ name: 'Bee' });
      expect(errorOf(() => profiles.update(ownerId, 999, { name: 'X' }))).toMatchObject({ statusCode: 404 });
    } finally { db.close(); }
  });

  it('needs the current PIN to change its own, but lets the owner clear anyone else\'s', () => {
    const { db, profiles, sessions, ownerId } = fixture();
    try {
      const kid = profiles.create(ownerId, { name: 'Kid', color: '#17c964', pin: '1234' });
      expect(errorOf(() => profiles.setPin(kid.id, kid.id, { pin: '5678' }, 'ip'))).toMatchObject({ statusCode: 401 });
      expect(errorOf(() => profiles.setPin(kid.id, kid.id, { currentPin: '0000', pin: '5678' }, 'ip'))).toMatchObject({ statusCode: 401 });
      expect(profiles.setPin(kid.id, kid.id, { currentPin: '1234', pin: '5678' }, 'ip')).toMatchObject({ hasPin: true });
      expect(sessions.select(kid.id, '5678', 'ip', null).profile.id).toBe(kid.id);

      expect(profiles.setPin(ownerId, kid.id, { pin: null }, 'ip')).toMatchObject({ hasPin: false });
      expect(errorOf(() => profiles.setPin(kid.id, ownerId, { pin: '1111' }, 'ip'))).toMatchObject({ statusCode: 403 });
      expect(profiles.setPin(ownerId, ownerId, { pin: '1111' }, 'ip')).toMatchObject({ hasPin: true });
      expect(errorOf(() => profiles.setPin(ownerId, ownerId, { pin: null }, 'ip'))).toMatchObject({ statusCode: 401 });
    } finally { db.close(); }
  });

  it('deletes profiles (owner only, never the owner) with their sessions', () => {
    const { db, records, profiles, sessions, ownerId } = fixture();
    try {
      const kid = profiles.create(ownerId, { name: 'Kid', color: '#17c964' }); const other = profiles.create(ownerId, { name: 'Other', color: '#17c964' });
      const { token } = sessions.select(kid.id, undefined, 'ip', null);
      expect(errorOf(() => profiles.remove(other.id, kid.id))).toMatchObject({ statusCode: 403 });
      expect(errorOf(() => profiles.remove(ownerId, ownerId))).toMatchObject({ statusCode: 403 });
      profiles.remove(ownerId, kid.id);
      expect(records.get(kid.id)).toBeUndefined();
      expect(sessions.sessionProfile(token)).toBeUndefined();
    } finally { db.close(); }
  });
});

describe('ProfileSessionService', () => {
  it('selects with the right PIN and throttles wrong ones per client and profile', () => {
    const { db, profiles, sessions, ownerId } = fixture();
    try {
      const kid = profiles.create(ownerId, { name: 'Kid', color: '#17c964', pin: '1234' });
      expect(errorOf(() => sessions.select(kid.id, undefined, 'ip', null))).toMatchObject({ statusCode: 401 });
      for (let attempt = 1; attempt < 5; attempt++) expect(errorOf(() => sessions.select(kid.id, '0000', 'ip', null))).toMatchObject({ statusCode: 401 });
      expect(errorOf(() => sessions.select(kid.id, '1234', 'ip', null))).toMatchObject({ statusCode: 429 });
      const fromElsewhere = sessions.select(kid.id, '1234', 'other-ip', null);
      expect(fromElsewhere.token).toMatch(/^[\w-]{43}$/);
      expect(sessions.sessionProfile(fromElsewhere.token)).toBe(kid.id);
      expect(sessions.select(ownerId, undefined, 'ip', null).profile.isOwner).toBe(true);
      expect(errorOf(() => sessions.select(999, undefined, 'ip', null))).toMatchObject({ statusCode: 404 });
    } finally { db.close(); }
  });

  it('falls back to the only profile while it has no PIN', () => {
    const { db, records, profiles, sessions, ownerId } = fixture();
    try {
      expect(sessions.requireProfile(undefined)).toBe(ownerId);
      records.setPinHash(ownerId, 'hash');
      expect(errorOf(() => sessions.requireProfile(undefined))).toMatchObject({ statusCode: 409, code: 'PROFILE_REQUIRED' });
      records.setPinHash(ownerId, null);
      const kid = profiles.create(ownerId, { name: 'Kid', color: '#17c964' });
      expect(errorOf(() => sessions.requireProfile(undefined))).toMatchObject({ statusCode: 409, code: 'PROFILE_REQUIRED' });
      expect(sessions.requireProfile(kid.id)).toBe(kid.id);
    } finally { db.close(); }
  });

  it('refreshes last_seen_at at most once a minute and forgets deselected sessions', () => {
    const { db, records } = fixture();
    try {
      let now = Date.parse('2026-10-24T10:00:00.000Z');
      const repo = new ProfileSessionRepository(db);
      const sessions = new ProfileSessionService(records, repo, new ProfilePinCheck(), () => now);
      const { token } = sessions.select(records.getOwner()!.id, undefined, 'ip', '00000000-0000-4000-8000-000000000000');
      const lastSeen = () => (db.prepare('SELECT last_seen_at AS at, device_id AS device FROM profile_sessions').get() as { at: string; device: string });
      expect(lastSeen().device).toBe('00000000-0000-4000-8000-000000000000');
      repo.touch((db.prepare('SELECT token_hash AS hash FROM profile_sessions').get() as { hash: string }).hash, '2026-10-24T10:00:00.000Z');
      now += 30_000; sessions.sessionProfile(token);
      expect(lastSeen().at).toBe('2026-10-24T10:00:00.000Z');
      now += 31_000; sessions.sessionProfile(token);
      expect(lastSeen().at).toBe('2026-10-24T10:01:01.000Z');
      sessions.deselect(token);
      expect(sessions.sessionProfile(token)).toBeUndefined();
    } finally { db.close(); }
  });
});

describe('LocalResetService', () => {
  it('clears the owner PIN and the access PIN and reports what it cleared', () => {
    const { db, records, ownerId } = fixture();
    try {
      const accessPin = new AccessPinService(new AccessPinRepository(db), new AuthSessionRepository(db));
      const reset = new LocalResetService(records, accessPin);
      expect(reset.reset()).toEqual({ ownerPinCleared: false, accessPinCleared: false });
      records.setPinHash(ownerId, 'hash'); accessPin.setPin({ newPin: '1357' }, 'ip');
      expect(reset.reset()).toEqual({ ownerPinCleared: true, accessPinCleared: true });
      expect(records.get(ownerId)!.pinHash).toBeNull();
      expect(accessPin.enabled()).toBe(false);
    } finally { db.close(); }
  });
});
