import { useState } from 'react';
import { useAccessPinActions, useAuthStatus } from '../hooks/useAccessPin';
import { focusRing, pressable } from './interactionStyles';

const fieldClassName = 'mt-1 w-full rounded-lg border border-border bg-field px-3 py-2 tracking-widest';
const digits = (value: string) => value.replace(/\D/g, '').slice(0, 8);

/** Set, change, or remove the optional access PIN. */
export function AccessPinSettingsSection() {
  const status = useAuthStatus();
  const { setPin, removePin, logout } = useAccessPinActions();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const enabled = status.data?.pinEnabled === true;
  const mismatch = confirmPin.length > 0 && newPin !== confirmPin;
  const canSave = newPin.length >= 4 && newPin === confirmPin && (!enabled || currentPin.length > 0) && !setPin.isPending;
  const reset = () => { setCurrentPin(''); setNewPin(''); setConfirmPin(''); };
  const error = setPin.error ?? removePin.error;

  return <section aria-labelledby="access-pin-heading" className="rounded-xl border border-border bg-surface p-5">
    <h2 id="access-pin-heading" className="font-semibold">Access PIN</h2>
    <p className="mt-1 text-sm text-muted">{enabled
      ? 'A PIN is set. Browsers and the TV and phone apps must enter it once before they can browse or stream.'
      : 'Off. Anyone on your network can browse and stream this library, and use its qBittorrent connection. Set a 4–8 digit PIN to require sign-in.'}</p>
    <form onSubmit={(event) => { event.preventDefault(); if (canSave) setPin.mutate({ currentPin: enabled ? currentPin : undefined, newPin }, { onSuccess: reset }); }} className="mt-4 grid gap-4 sm:grid-cols-3">
      {enabled && <label className="block text-sm">Current PIN<input value={currentPin} onChange={(event) => setCurrentPin(digits(event.target.value))} type="password" inputMode="numeric" autoComplete="current-password" className={fieldClassName} /></label>}
      <label className="block text-sm">{enabled ? 'New PIN' : 'PIN'}<input value={newPin} onChange={(event) => setNewPin(digits(event.target.value))} type="password" inputMode="numeric" autoComplete="new-password" className={fieldClassName} /></label>
      <label className="block text-sm">Confirm PIN<input value={confirmPin} onChange={(event) => setConfirmPin(digits(event.target.value))} type="password" inputMode="numeric" autoComplete="new-password" aria-invalid={mismatch} className={fieldClassName} /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button disabled={!canSave} className={`rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${pressable}`}>{setPin.isPending ? 'Saving…' : enabled ? 'Change PIN' : 'Set PIN'}</button>
        {enabled && <button type="button" disabled={!currentPin || removePin.isPending} onClick={() => removePin.mutate(currentPin, { onSuccess: reset })} className={`rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-error hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${pressable}`}>Remove PIN</button>}
        {enabled && <button type="button" onClick={() => logout.mutate()} className={`ml-auto text-sm text-muted hover:text-foreground ${focusRing}`}>Sign out this browser</button>}
        {mismatch && <span className="text-sm text-error">PINs don’t match.</span>}
      </div>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-error">{error.message}</p>}
  </section>;
}
