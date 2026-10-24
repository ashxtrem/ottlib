import { useState } from 'react';
import { Modal } from './Modal';
import { focusRing, pressable } from './interactionStyles';
import { appendPinDigit, isCompletePin, MAX_PIN_LENGTH, removeLastPinDigit, sanitizePin } from '../utils/pinInput';

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const keyClassName = `h-14 rounded-xl border border-border bg-surface-raised text-xl font-semibold hover:bg-field disabled:opacity-50 ${focusRing} ${pressable}`;

interface PinPadProps {
  open: boolean;
  title: string;
  /** Shown under the field, e.g. "Wrong PIN. Try again." */
  error?: string | null;
  pending?: boolean;
  onSubmit: (pin: string) => void;
  onClose: () => void;
}

/** PIN entry for a locked profile: a numeric field (4–8 digits) plus an on-screen 0–9 keypad for TV remotes and touch. */
export function PinPad({ open, title, error, pending = false, onSubmit, onClose }: PinPadProps) {
  return <Modal open={open} onClose={onClose} title={title} maxWidthClassName="max-w-xs">
    {open && <PinPadBody error={error} pending={pending} onSubmit={onSubmit} />}
  </Modal>;
}

function PinPadBody({ error, pending, onSubmit }: { error?: string | null; pending: boolean; onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const complete = isCompletePin(pin);
  const press = (digit: string) => setPin((current) => appendPinDigit(current, digit));
  // The field empties on submit: a right PIN closes the pad, a wrong one leaves it ready for the next try.
  return <form className="p-5" onSubmit={(event) => { event.preventDefault(); if (!complete || pending) return; onSubmit(pin); setPin(''); }}>
    <label htmlFor="profile-pin" className="sr-only">Profile PIN</label>
    <input id="profile-pin" value={pin} onChange={(event) => setPin(sanitizePin(event.target.value))} type="password" inputMode="numeric" pattern="[0-9]*" maxLength={MAX_PIN_LENGTH} autoComplete="off" autoFocus
      aria-invalid={Boolean(error)} aria-describedby={error ? 'profile-pin-error' : undefined}
      className="w-full rounded-lg border border-border bg-field px-3 py-3 text-center text-2xl tracking-[0.5em]" />
    <p id="profile-pin-error" role="alert" className="mt-2 min-h-5 text-center text-sm text-error">{error}</p>
    <div className="mt-3 grid grid-cols-3 gap-2">
      {keys.map((digit) => <button key={digit} type="button" onClick={() => press(digit)} disabled={pending} className={keyClassName}>{digit}</button>)}
      <button type="button" onClick={() => setPin(removeLastPinDigit)} disabled={pending || !pin} aria-label="Delete last digit" className={keyClassName}>⌫</button>
      <button type="button" onClick={() => press('0')} disabled={pending} className={keyClassName}>0</button>
      <button type="submit" disabled={!complete || pending} aria-label="Unlock" className={`h-14 rounded-xl bg-accent text-base font-semibold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${pressable}`}>{pending ? '…' : 'OK'}</button>
    </div>
  </form>;
}
