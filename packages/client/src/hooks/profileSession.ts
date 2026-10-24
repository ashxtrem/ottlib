const tokenKey = 'ottlib-profile-session';
const lastProfileKey = 'ottlib-last-profile';

/** Fired when the server answers 409 PROFILE_REQUIRED, so the profile gate can show the picker. */
export const profileRequiredEvent = 'ottlib:profile-required';

// Kept in memory too, so a browser with blocked storage still keeps its profile for this page load.
let memoryToken: string | null = null;

export function getProfileToken(): string | null {
  try { return localStorage.getItem(tokenKey) ?? memoryToken; } catch { return memoryToken; }
}

export function setProfileToken(token: string): void {
  memoryToken = token;
  try { localStorage.setItem(tokenKey, token); } catch { /* The memory copy covers this page load. */ }
}

export function clearProfileToken(): void {
  memoryToken = null;
  try { localStorage.removeItem(tokenKey); } catch { /* Nothing stored. */ }
}

/**
 * Handles a 409 PROFILE_REQUIRED for a request sent with `sentToken`. A late reply to a request sent before the user
 * picked a profile must not throw away the new token, so only a still-current token is cleared and reported.
 */
export function reportProfileRequired(sentToken: string | null): void {
  if (getProfileToken() !== sentToken) return;
  clearProfileToken();
  window.dispatchEvent(new Event(profileRequiredEvent));
}

/** The profile picked last on this browser, so the picker can focus it first. */
export function getLastProfileId(): number | null {
  try { const value = Number(localStorage.getItem(lastProfileKey)); return Number.isInteger(value) && value > 0 ? value : null; } catch { return null; }
}

export function setLastProfileId(id: number): void {
  try { localStorage.setItem(lastProfileKey, String(id)); } catch { /* Only a focus hint. */ }
}
