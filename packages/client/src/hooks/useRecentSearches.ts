import { useCallback, useEffect, useState } from 'react';
import { useCurrentProfile } from './useProfile';

export const maxRecentSearches = 8;
export const minRecentSearchLength = 2;
/** How long a search stays unchanged before it counts as a finished search. */
export const recentSearchSettleMs = 1500;

const storageKeyPrefix = 'ottlib-recent-searches:';

export function recentSearchesKey(profileId: number): string {
  return `${storageKeyPrefix}${profileId}`;
}

/** Newest first, no duplicates (ignoring case), at most eight. A term under two characters is not kept. */
export function addRecentSearch(list: string[], term: string): string[] {
  const value = term.trim().replace(/\s+/g, ' ');
  if (value.length < minRecentSearchLength) return list;
  const lower = value.toLowerCase();
  return [value, ...list.filter((entry) => entry.toLowerCase() !== lower)].slice(0, maxRecentSearches);
}

export function removeRecentSearch(list: string[], term: string): string[] {
  return list.filter((entry) => entry !== term);
}

export function parseRecentSearches(raw: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length >= minRecentSearchLength).slice(0, maxRecentSearches);
  } catch { return []; }
}

function readRecentSearches(key: string): string[] {
  try { return parseRecentSearches(localStorage.getItem(key)); } catch { return []; }
}

function writeRecentSearches(key: string, list: string[]): void {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* Local storage is optional. */ }
}

/** The last searches for the current profile on this device. `search` is the live text: it is saved once it has stayed unchanged for 1.5 s. */
export function useRecentSearches(search: string) {
  const profileId = useCurrentProfile().data?.profile.id;
  const key = profileId === undefined ? undefined : recentSearchesKey(profileId);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => { setRecents(key === undefined ? [] : readRecentSearches(key)); }, [key]);

  const remember = useCallback((term: string) => {
    if (key === undefined) return;
    const current = readRecentSearches(key); const next = addRecentSearch(current, term);
    if (next === current) return;
    writeRecentSearches(key, next); setRecents(next);
  }, [key]);

  const forget = useCallback((term: string) => {
    if (key === undefined) return;
    const next = removeRecentSearch(readRecentSearches(key), term);
    writeRecentSearches(key, next); setRecents(next);
  }, [key]);

  useEffect(() => {
    if (search.trim().length < minRecentSearchLength) return;
    const timer = window.setTimeout(() => remember(search), recentSearchSettleMs);
    return () => window.clearTimeout(timer);
  }, [search, remember]);

  return { recents, remember, forget };
}
