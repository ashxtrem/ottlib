import { useState } from 'react';
import type { ProfilePinUpdate, ProfileSummary } from '@ottlib/shared';
import { Modal } from './Modal';
import { focusRing, pressable } from './interactionStyles';
import { isCompletePin, sanitizePin } from '../utils/pinInput';

interface ProfilePinDialogProps {
  profile: ProfileSummary | null;
  /** The profile changing its own existing PIN types it first; the owner changing someone else's does not. */
  needsCurrentPin: boolean;
  pending: boolean;
  error?: string | null;
  onSubmit: (input: ProfilePinUpdate) => void;
  onClose: () => void;
}

const fieldClassName = 'mt-1 w-full rounded-lg border border-border bg-field px-3 py-2 tracking-widest';

/** Set, change or remove a profile's PIN. */
export function ProfilePinDialog(props: ProfilePinDialogProps) {
  const { profile, onClose } = props;
  const title = profile ? `${profile.hasPin ? 'Change' : 'Set'} PIN for ${profile.name}` : '';
  return <Modal open={profile !== null} onClose={onClose} title={title} maxWidthClassName="max-w-md">
    {profile && <PinForm key={profile.id} {...props} profile={profile} />}
  </Modal>;
}

function PinForm({ profile, needsCurrentPin, pending, error, onSubmit, onClose }: ProfilePinDialogProps & { profile: ProfileSummary }) {
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const hasCurrent = !needsCurrentPin || currentPin.length > 0;
  const mismatch = confirmPin.length > 0 && pin !== confirmPin;
  const canSave = isCompletePin(pin) && pin === confirmPin && hasCurrent && !pending;
  const withCurrent = (next: string | null): ProfilePinUpdate => needsCurrentPin ? { currentPin, pin: next } : { pin: next };

  return <form onSubmit={(event) => { event.preventDefault(); if (canSave) onSubmit(withCurrent(pin)); }}>
    <div className="grid gap-4 p-5 sm:grid-cols-2">
      {needsCurrentPin && <label className="block text-sm sm:col-span-2">Current PIN<input value={currentPin} onChange={(event) => setCurrentPin(sanitizePin(event.target.value))} type="password" inputMode="numeric" autoComplete="current-password" autoFocus className={fieldClassName} /></label>}
      <label className="block text-sm">{profile.hasPin ? 'New PIN' : 'PIN'}<input value={pin} onChange={(event) => setPin(sanitizePin(event.target.value))} type="password" inputMode="numeric" autoComplete="new-password" autoFocus={!needsCurrentPin} className={fieldClassName} /></label>
      <label className="block text-sm">Confirm PIN<input value={confirmPin} onChange={(event) => setConfirmPin(sanitizePin(event.target.value))} type="password" inputMode="numeric" autoComplete="new-password" aria-invalid={mismatch} className={fieldClassName} /></label>
      <p className="text-xs text-muted sm:col-span-2">4 to 8 digits.{mismatch && <span className="ml-2 text-error">PINs don’t match.</span>}</p>
      {error && <p role="alert" className="text-sm text-error sm:col-span-2">{error}</p>}
    </div>
    <div className="flex flex-wrap justify-end gap-3 border-t border-border p-4">
      {profile.hasPin && <button type="button" disabled={!hasCurrent || pending} onClick={() => onSubmit(withCurrent(null))} className={`mr-auto rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-error hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${pressable}`}>Remove PIN</button>}
      <button type="button" onClick={onClose} className={`rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised ${focusRing}`}>Cancel</button>
      <button disabled={!canSave} className={`rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${pressable}`}>{pending ? 'Saving…' : 'Save PIN'}</button>
    </div>
  </form>;
}
