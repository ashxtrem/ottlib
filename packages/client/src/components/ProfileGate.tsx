import type { ReactNode } from 'react';
import { useCurrentProfile } from '../hooks/useProfile';
import { ProfilePicker } from './ProfilePicker';

/**
 * Shows the profile picker instead of the app until this browser acts as a profile. Sits inside the access-PIN gate.
 * A library with one PIN-less profile answers /me with it, so the picker never shows there.
 */
export function ProfileGate({ children }: { children: ReactNode }) {
  const current = useCurrentProfile();
  // A server without profiles (or a failed check) keeps the app usable rather than blocking it.
  if (current.data === undefined) return current.isError ? <>{children}</> : null;
  if (current.data === null) return <ProfilePicker />;
  return <>{children}</>;
}
