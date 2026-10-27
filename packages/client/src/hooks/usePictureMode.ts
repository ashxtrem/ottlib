import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { pageStorage, type StorageLike } from '../utils/pageStorage';
import { parsePictureDefault, parsePictureModes, pictureModeFor, type PictureModeId } from '../utils/pictureModes';

/** Picture modes live only in this browser: each device remembers its own mode per title and its own default. */
export const PICTURE_MODES_KEY = 'ottlib-picture-modes';
export const PICTURE_DEFAULT_KEY = 'ottlib-picture-default';

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
