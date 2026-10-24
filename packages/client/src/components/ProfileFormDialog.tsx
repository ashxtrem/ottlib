import { useState } from 'react';
import { profileColors, profileNameSchema, type ProfileColor, type ProfileSummary } from '@ottlib/shared';
import { Modal } from './Modal';
import { ProfileAvatar } from './ProfileAvatar';
import { focusRing, pressable } from './interactionStyles';
import { isCompletePin, sanitizePin } from '../utils/pinInput';

export interface ProfileFormValues { name: string; color: ProfileColor; pin?: string }

interface ProfileFormDialogProps {
  open: boolean;
  /** Editing this profile; adding a new one when absent. */
  profile?: ProfileSummary;
  /** Colors already used, offered last when adding. */
  usedColors?: string[];
  pending: boolean;
  error?: string | null;
  onSubmit: (values: ProfileFormValues) => void;
  onClose: () => void;
}

const fieldClassName = 'mt-1 w-full rounded-lg border border-border bg-field px-3 py-2';

/** Add a profile (name, color, optional PIN) or rename / recolor one. */
export function ProfileFormDialog(props: ProfileFormDialogProps) {
  const { open, profile, onClose } = props;
  return <Modal open={open} onClose={onClose} title={profile ? `Edit ${profile.name}` : 'Add profile'} maxWidthClassName="max-w-md">
    {open && <ProfileForm key={profile?.id ?? 'new'} {...props} />}
  </Modal>;
}

function firstFreeColor(used: string[]): ProfileColor {
  return profileColors.find((color) => !used.includes(color)) ?? profileColors[0];
}

function ProfileForm({ profile, usedColors = [], pending, error, onSubmit, onClose }: ProfileFormDialogProps) {
  const adding = !profile;
  const [name, setName] = useState(profile?.name ?? '');
  const [color, setColor] = useState<ProfileColor>(() => (profileColors as readonly string[]).includes(profile?.color ?? '') ? profile!.color as ProfileColor : firstFreeColor(usedColors));
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const nameCheck = profileNameSchema.safeParse(name);
  const pinProblem = pin.length > 0 && !isCompletePin(pin) ? 'PIN must be 4 to 8 digits.' : confirmPin.length > 0 && pin !== confirmPin ? 'PINs don’t match.' : null;
  const canSave = nameCheck.success && !pending && (!adding || pin.length === 0 || (isCompletePin(pin) && pin === confirmPin));

  return <form onSubmit={(event) => { event.preventDefault(); if (canSave) onSubmit({ name: name.trim(), color, pin: adding && pin ? pin : undefined }); }}>
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-4">
        <ProfileAvatar name={name || '?'} color={color} className="h-14 w-14 text-2xl" />
        <label className="block flex-1 text-sm">Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} autoFocus autoComplete="off" className={fieldClassName} /></label>
      </div>
      <fieldset>
        <legend className="text-sm">Color</legend>
        <div role="radiogroup" aria-label="Color" className="mt-2 flex flex-wrap gap-3">
          {profileColors.map((option, index) => <button key={option} type="button" role="radio" aria-checked={color === option} aria-label={`Color ${index + 1}`} onClick={() => setColor(option)} style={{ backgroundColor: option }}
            className={`h-10 w-10 rounded-full border-2 ${color === option ? 'border-foreground' : 'border-transparent'} ${focusRing} ${pressable}`} />)}
        </div>
      </fieldset>
      {adding && <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">PIN (optional)<input value={pin} onChange={(event) => setPin(sanitizePin(event.target.value))} type="password" inputMode="numeric" autoComplete="new-password" className={`${fieldClassName} tracking-widest`} /></label>
        {pin.length > 0 && <label className="block text-sm">Confirm PIN<input value={confirmPin} onChange={(event) => setConfirmPin(sanitizePin(event.target.value))} type="password" inputMode="numeric" autoComplete="new-password" className={`${fieldClassName} tracking-widest`} /></label>}
      </div>}
      {!nameCheck.success && name.length > 0 && <p className="text-sm text-error">{nameCheck.error.issues[0]?.message}</p>}
      {pinProblem && <p className="text-sm text-error">{pinProblem}</p>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
    <div className="flex justify-end gap-3 border-t border-border p-4">
      <button type="button" onClick={onClose} className={`rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised ${focusRing}`}>Cancel</button>
      <button disabled={!canSave} className={`rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${pressable}`}>{pending ? 'Saving…' : adding ? 'Add profile' : 'Save'}</button>
    </div>
  </form>;
}
