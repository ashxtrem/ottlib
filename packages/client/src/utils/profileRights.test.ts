import { describe, expect, it } from 'vitest';
import type { ProfileSummary } from '@ottlib/shared';
import { canAddProfile, canSwitchProfile, profileInitial, profileRights } from './profileRights';

const owner: ProfileSummary = { id: 1, name: 'Home', color: '#e50914', hasPin: true, isOwner: true };
const kid: ProfileSummary = { id: 2, name: 'kid', color: '#17c964', hasPin: true, isOwner: false };
const guest: ProfileSummary = { id: 3, name: 'Guest', color: '#006fee', hasPin: false, isOwner: false };

describe('profileRights', () => {
  it('lets the owner edit, delete and clear the PIN of others', () => {
    expect(profileRights(owner, kid)).toEqual({ canEdit: true, canDelete: true, needsCurrentPin: false, canClearPinDirectly: true });
    expect(profileRights(owner, guest).canClearPinDirectly).toBe(false);
  });

  it('never deletes the owner profile and asks the owner for its own current PIN', () => {
    expect(profileRights(owner, owner)).toEqual({ canEdit: true, canDelete: false, needsCurrentPin: true, canClearPinDirectly: false });
  });

  it('lets other profiles edit only themselves', () => {
    expect(profileRights(kid, kid)).toEqual({ canEdit: true, canDelete: false, needsCurrentPin: true, canClearPinDirectly: false });
    expect(profileRights(kid, guest)).toEqual({ canEdit: false, canDelete: false, needsCurrentPin: false, canClearPinDirectly: false });
    expect(profileRights(guest, guest).needsCurrentPin).toBe(false);
    expect(profileRights(undefined, guest).canEdit).toBe(false);
  });

  it('shows Add profile to the owner below the limit only', () => {
    expect(canAddProfile(owner, 5)).toBe(true);
    expect(canAddProfile(owner, 6)).toBe(false);
    expect(canAddProfile(kid, 2)).toBe(false);
  });

  it('offers switching when another profile exists or this one is locked', () => {
    expect(canSwitchProfile(guest, 1)).toBe(false);
    expect(canSwitchProfile(kid, 1)).toBe(true);
    expect(canSwitchProfile(guest, 2)).toBe(true);
  });

  it('uses an upper-case initial', () => {
    expect(profileInitial(' kid')).toBe('K');
    expect(profileInitial('')).toBe('?');
  });
});
