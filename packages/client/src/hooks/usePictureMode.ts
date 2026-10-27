import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { parsePictureDefault, parsePictureModes, pictureModeFor, type PictureModeId } from '../utils/pictureModes';

/** Picture modes live only in this browser: each device remembers its own mode per title and its own default. */
export const PICTURE_MODES_KEY = 'ottlib-picture-modes';
export const PICTURE_DEFAULT_KEY = 'ottlib-picture-default';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function readRaw(storage: StorageLike, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; /* Storage can be unavailable (private mode). */ }
}

function writeRaw(storage: StorageLike, key: string, value: string): void {
  try { storage.setItem(key, value); } catch { /* A remembered mode is a convenience; ignore a full or blocked store. */ }
}

export function readPictureModes(storage: StorageLike): Record<string, PictureModeId> {
  return parsePictureModes(readRaw(storage, PICTURE_MODES_KEY));
}

export function readPictureDefault(storage: StorageLike): PictureModeId {
  return parsePictureDefault(readRaw(storage, PICTURE_DEFAULT_KEY));
}

export function writePictureMode(storage: StorageLike, movieId: number, mode: PictureModeId): void {
  writeRaw(storage, PICTURE_MODES_KEY, JSON.stringify({ ...readPictureModes(storage), [String(movieId)]: mode }));
}

export function writePictureDefault(storage: StorageLike, mode: PictureModeId): void {
  writeRaw(storage, PICTURE_DEFAULT_KEY, mode);
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === PICTURE_MODES_KEY || event.key === PICTURE_DEFAULT_KEY) listener(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** `window.localStorage` throws a SecurityError when storage is blocked; null then. */
export function safeStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** Holds what was picked when the browser store is blocked or refuses writes, so a pick still applies for the session. */
export function memoryStorage(): StorageLike & { clear(): void } {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, clear: () => data.clear() };
}

const sessionStore = memoryStorage();

/** Keys whose last write the browser store refused: the session copy is the truth for those. */
const sessionOnly = new Set<string>();

/** The browser store when it works, the session copy when it is blocked or refuses a write. */
export function pageStorage(): StorageLike {
  const real = safeStorage();
  return {
    getItem: (key) => (!real || sessionOnly.has(key) ? sessionStore.getItem(key) : readRaw(real, key)),
    setItem: (key, value) => {
      sessionStore.setItem(key, value);
      try {
        if (!real) throw new Error('storage blocked');
        real.setItem(key, value);
        sessionOnly.delete(key);
      } catch { sessionOnly.add(key); }
    }
  };
}

/** The raw stored strings are the snapshots: equal strings compare equal, so nothing re-renders without a change. */
const rawModes = () => readRaw(pageStorage(), PICTURE_MODES_KEY);
const rawDefault = () => readRaw(pageStorage(), PICTURE_DEFAULT_KEY);

/** This device's default picture mode (used by titles with no mode of their own). */
export function usePictureDefault() {
  const raw = useSyncExternalStore(subscribe, rawDefault, () => null);
  const defaultMode = useMemo(() => parsePictureDefault(raw), [raw]);
  const setDefaultMode = useCallback((mode: PictureModeId) => { writePictureDefault(pageStorage(), mode); notify(); }, []);
  return { defaultMode, setDefaultMode };
}

/** The picture mode of one title: what was picked for it on this device, else the device default. */
export function usePictureMode(movieId: number) {
  const raw = useSyncExternalStore(subscribe, rawModes, () => null);
  const { defaultMode } = usePictureDefault();
  const modes = useMemo(() => parsePictureModes(raw), [raw]);
  const mode = pictureModeFor(modes, movieId, defaultMode);
  const setMode = useCallback((next: PictureModeId) => { writePictureMode(pageStorage(), movieId, next); notify(); }, [movieId]);
  return { mode, setMode };
}
