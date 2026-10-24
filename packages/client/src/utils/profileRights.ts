import { MAX_PROFILES, type ProfileSummary } from '@ottlib/shared';

export interface ProfileRights {
  /** Rename, recolor and set or change the PIN. */
  canEdit: boolean;
  canDelete: boolean;
  /** A profile changing or clearing its own existing PIN must type it first. */
  needsCurrentPin: boolean;
  /** The owner clears another profile's PIN without knowing it. */
  canClearPinDirectly: boolean;
}

/** What `me` may do to `target`, mirroring the server's owner rules so only allowed buttons show. */
export function profileRights(me: ProfileSummary | undefined, target: ProfileSummary): ProfileRights {
  if (!me) return { canEdit: false, canDelete: false, needsCurrentPin: false, canClearPinDirectly: false };
  const self = me.id === target.id;
  return {
    canEdit: self || me.isOwner,
    canDelete: me.isOwner && !target.isOwner,
    needsCurrentPin: self && target.hasPin,
    canClearPinDirectly: me.isOwner && !self && target.hasPin
  };
}

export const canAddProfile = (me: ProfileSummary | undefined, count: number): boolean => me?.isOwner === true && count < MAX_PROFILES;

/** Switching only leads somewhere when another profile exists or this one is locked behind a PIN. */
export const canSwitchProfile = (current: ProfileSummary, count: number): boolean => count > 1 || current.hasPin;

export const profileInitial = (name: string): string => (name.trim()[0] ?? '?').toLocaleUpperCase();
