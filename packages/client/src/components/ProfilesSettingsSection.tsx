import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { ProfileSummary } from '@ottlib/shared';
import { useCurrentProfile, useProfiles } from '../hooks/useProfile';
import { useLocalPinReset, useProfileActions } from '../hooks/useProfileActions';
import { useIsLocalClient } from '../hooks/useIsLocalClient';
import { canAddProfile, profileRights } from '../utils/profileRights';
import { pinErrorMessage } from '../utils/pinInput';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileFormDialog, type ProfileFormValues } from './ProfileFormDialog';
import { ProfilePinDialog } from './ProfilePinDialog';
import { ProfileDeleteDialog } from './ProfileDeleteDialog';
import { focusRing, pressable } from './interactionStyles';

const rowButtonClassName = `rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface-raised disabled:opacity-60 ${focusRing} ${pressable}`;
const badgeClassName = 'rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted';

type Editing = { kind: 'add' } | { kind: 'edit'; profile: ProfileSummary } | null;

/** Settings → Profiles: list, add (owner, up to 6), rename/recolor and PIN (self or owner), delete (owner). */
export function ProfilesSettingsSection() {
  const me = useCurrentProfile().data?.profile;
  const profiles = useProfiles();
  const { create, update, setPin, remove } = useProfileActions();
  const [editing, setEditing] = useState<Editing>(null);
  const [pinTarget, setPinTarget] = useState<ProfileSummary | null>(null);
  const [deleting, setDeleting] = useState<ProfileSummary | null>(null);
  const list = profiles.data ?? [];
  const formMutation = editing?.kind === 'edit' ? update : create;
  const section = useRef<HTMLElement>(null);
  const { hash } = useLocation();
  // The header's "Manage profiles" link lands here.
  useEffect(() => { if (hash === '#profiles') section.current?.scrollIntoView({ block: 'start' }); }, [hash]);

  const openForm = (next: Editing) => { create.reset(); update.reset(); setEditing(next); };
  const openPin = (profile: ProfileSummary) => { setPin.reset(); setPinTarget(profile); };
  const submitForm = (values: ProfileFormValues) => {
    if (editing?.kind === 'edit') update.mutate({ id: editing.profile.id, patch: { name: values.name, color: values.color } }, { onSuccess: () => setEditing(null) });
    else create.mutate(values, { onSuccess: () => setEditing(null) });
  };

  return <section ref={section} id="profiles" aria-labelledby="profiles-heading" className="scroll-mt-24 rounded-xl border border-border bg-surface p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="profiles-heading" className="font-semibold">Profiles</h2>
      {canAddProfile(me, list.length) && <button type="button" onClick={() => openForm({ kind: 'add' })} className={`rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover ${focusRing} ${pressable}`}>Add profile</button>}
    </div>
    <p className="mt-1 text-sm text-muted">Each profile has its own watch progress, watched titles and hidden titles. Shelves and settings are shared. Profile PINs keep watch lists separate. They don't secure the library.</p>
    {profiles.isError && <p role="alert" className="mt-3 text-sm text-error">{profiles.error.message}</p>}
    <ul className="mt-4 divide-y divide-border">
      {list.map((profile) => <ProfileRow key={profile.id} profile={profile} me={me} clearing={setPin.isPending && setPin.variables?.id === profile.id}
        onEdit={() => openForm({ kind: 'edit', profile })} onPin={() => openPin(profile)} onDelete={() => { remove.reset(); setDeleting(profile); }}
        onClearPin={() => setPin.mutate({ id: profile.id, input: { pin: null } })} />)}
    </ul>
    {setPin.error && !pinTarget && <p role="alert" className="mt-3 text-sm text-error">{setPin.error.message}</p>}
    <PinResetNote />

    <ProfileFormDialog open={editing !== null} profile={editing?.kind === 'edit' ? editing.profile : undefined} usedColors={list.map((profile) => profile.color)}
      pending={formMutation.isPending} error={formMutation.error?.message} onSubmit={submitForm} onClose={() => setEditing(null)} />
    <ProfilePinDialog profile={pinTarget} needsCurrentPin={pinTarget ? profileRights(me, pinTarget).needsCurrentPin : false} pending={setPin.isPending}
      error={setPin.error ? pinErrorMessage(setPin.error) : null} onClose={() => setPinTarget(null)}
      onSubmit={(input) => { if (pinTarget) setPin.mutate({ id: pinTarget.id, input }, { onSuccess: () => setPinTarget(null) }); }} />
    <ProfileDeleteDialog profile={deleting} deleting={remove.isPending} error={remove.error?.message} onCancel={() => setDeleting(null)}
      onConfirm={() => { if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) }); }} />
  </section>;
}

interface ProfileRowProps { profile: ProfileSummary; me?: ProfileSummary; clearing: boolean; onEdit: () => void; onPin: () => void; onClearPin: () => void; onDelete: () => void }

function ProfileRow({ profile, me, clearing, onEdit, onPin, onClearPin, onDelete }: ProfileRowProps) {
  const rights = profileRights(me, profile);
  return <li className="flex flex-wrap items-center gap-3 py-3">
    <ProfileAvatar name={profile.name} color={profile.color} className="h-10 w-10 text-base" />
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium">{profile.name}</p>
      <p className="mt-0.5 flex flex-wrap gap-1.5">
        {profile.id === me?.id && <span className={badgeClassName}>You</span>}
        {profile.isOwner && <span className={badgeClassName}>Owner</span>}
        {profile.hasPin && <span className={badgeClassName}>PIN</span>}
      </p>
    </div>
    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
      {rights.canEdit && <button type="button" onClick={onEdit} className={rowButtonClassName}>Edit</button>}
      {rights.canEdit && <button type="button" onClick={onPin} className={rowButtonClassName}>{profile.hasPin ? 'Change PIN' : 'Set PIN'}</button>}
      {rights.canClearPinDirectly && <button type="button" onClick={onClearPin} disabled={clearing} className={rowButtonClassName}>{clearing ? 'Clearing…' : 'Clear PIN'}</button>}
      {rights.canDelete && <button type="button" onClick={onDelete} className={`${rowButtonClassName} text-error`}>Delete</button>}
    </div>
  </li>;
}

function PinResetNote() {
  const isLocal = useIsLocalClient();
  const reset = useLocalPinReset();
  return <div className="mt-4 rounded-lg border border-border bg-surface-raised/50 p-3 text-sm text-muted">
    <p>Forgot the owner PIN? Open Settings on the server computer and use Reset PINs, or run <code className="rounded bg-field px-1 py-0.5 text-foreground">npm run reset-pins</code>.</p>
    {isLocal && <div className="mt-3 flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => reset.mutate()} disabled={reset.isPending} className={rowButtonClassName}>{reset.isPending ? 'Resetting…' : 'Reset PINs'}</button>
      <span className="text-xs">Clears the owner profile's PIN and the access PIN.</span>
    </div>}
    {reset.error && <p role="alert" className="mt-2 text-error">{reset.error.message}</p>}
  </div>;
}
