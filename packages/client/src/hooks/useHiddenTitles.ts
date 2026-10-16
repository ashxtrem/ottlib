import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { hideKeyOf } from '@ottlib/shared';
import { parseHiddenTitles, withHidden, withoutHidden, type HiddenTitle, type HideableMovie } from '../utils/hiddenTitleList';

/** Hidden titles live only in this browser, so hiding on one device never changes what another device sees. */
const storageKey = 'ottlib-hidden-titles';
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedList: HiddenTitle[] = [];

function read(): HiddenTitle[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(storageKey); } catch { /* Storage can be unavailable (private mode). */ }
  if (raw !== cachedRaw) { cachedRaw = raw; cachedList = parseHiddenTitles(raw); }
  return cachedList;
}

function write(list: HiddenTitle[]): void {
  try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch { /* Hiding is a convenience; ignore a full or blocked store. */ }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === storageKey) listener(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

export function useHiddenTitles() {
  const hidden = useSyncExternalStore(subscribe, read, () => []);
  const keys = useMemo(() => new Set(hidden.map((entry) => entry.key)), [hidden]);
  const isHidden = useCallback((movie: Pick<HideableMovie, 'id' | 'showKey'>) => keys.has(hideKeyOf(movie)), [keys]);
  const hide = useCallback((movie: HideableMovie) => write(withHidden(read(), movie)), []);
  const unhide = useCallback((key: string) => write(withoutHidden(read(), key)), []);
  const unhideAll = useCallback(() => write([]), []);
  return { hidden, isHidden, hide, unhide, unhideAll };
}
