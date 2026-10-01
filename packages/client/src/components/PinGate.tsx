import { useState, type ReactNode } from 'react';
import { useAccessPinActions, useAuthStatus } from '../hooks/useAccessPin';
import { focusRing, pressable } from './interactionStyles';

/** Shows the sign-in screen instead of the app while an access PIN is set and this browser is not signed in. */
export function PinGate({ children }: { children: ReactNode }) {
  const status = useAuthStatus();
  if (!status.data) return status.isError ? <>{children}</> : null;
  if (status.data.pinEnabled && !status.data.authenticated) return <PinSignIn />;
  return <>{children}</>;
}

function PinSignIn() {
  const { login } = useAccessPinActions();
  const [pin, setPin] = useState('');
  return <main className="flex min-h-screen items-center justify-center px-4">
    <form onSubmit={(event) => { event.preventDefault(); if (pin) login.mutate(pin, { onError: () => setPin('') }); }} className="w-full max-w-sm animate-rise-in rounded-2xl border border-border bg-surface p-6 text-center shadow-lg">
      <img src="/icons/ottlib-192.png" alt="" className="mx-auto h-14 w-14" />
      <h1 className="mt-4 text-xl font-bold">Enter access PIN</h1>
      <p className="mt-1 text-sm text-muted">This OttLib library is protected. Ask whoever runs it for the PIN.</p>
      <label htmlFor="access-pin" className="sr-only">Access PIN</label>
      <input id="access-pin" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" autoComplete="current-password" type="password" autoFocus className="mt-5 w-full rounded-lg border border-border bg-field px-3 py-3 text-center text-2xl tracking-[0.5em]" />
      {login.error && <p role="alert" className="mt-3 text-sm text-error">{login.error.message}</p>}
      <button disabled={!pin || login.isPending} className={`mt-5 w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-foreground transition-[background-color,transform] duration-fast ease-emphasis hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${pressable}`}>{login.isPending ? 'Checking…' : 'Unlock'}</button>
    </form>
  </main>;
}
