import { useCallback, useState } from 'react';
import { pageStorage } from './usePictureMode';
import { parseTrackChoices, parseTrackLanguages, recordTrackChoice, rememberedLanguages, type TrackLanguages } from '../utils/trackMemory';

/** Track languages live only in this browser, like picture modes: per title, and the last ones chosen on this device. */
export const TRACK_CHOICES_KEY = 'ottlib-track-choices';
export const TRACK_LANGUAGES_KEY = 'ottlib-track-languages';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function read(storage: StorageLike, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; /* Storage can be unavailable (private mode). */ }
}

function write(storage: StorageLike, key: string, value: string): void {
  try { storage.setItem(key, value); } catch { /* A remembered language is a convenience; ignore a full or blocked store. */ }
}

export function readRememberedLanguages(storage: StorageLike, movieId: number): TrackLanguages {
  return rememberedLanguages(parseTrackChoices(read(storage, TRACK_CHOICES_KEY)), movieId, parseTrackLanguages(read(storage, TRACK_LANGUAGES_KEY)));
}

/** Records a pick for the title and as this device's last-chosen languages. */
export function writeTrackPick(storage: StorageLike, movieId: number, picked: TrackLanguages): void {
  // A track without a language leaves what was remembered alone.
  const pick: TrackLanguages = {};
  if (picked.audio !== undefined) pick.audio = picked.audio;
  if (picked.subtitle !== undefined) pick.subtitle = picked.subtitle;
  if (Object.keys(pick).length === 0) return;
  write(storage, TRACK_CHOICES_KEY, JSON.stringify(recordTrackChoice(parseTrackChoices(read(storage, TRACK_CHOICES_KEY)), movieId, pick)));
  write(storage, TRACK_LANGUAGES_KEY, JSON.stringify({ ...parseTrackLanguages(read(storage, TRACK_LANGUAGES_KEY)), ...pick }));
}

/**
 * The languages this title should start with (its own choice, then the last-chosen ones; read once per player so a pick
 * doesn't move the start), and `record` for the viewer's picks in the menus.
 */
export function useTrackMemory(movieId: number) {
  const [wanted] = useState(() => readRememberedLanguages(pageStorage(), movieId));
  const record = useCallback((pick: TrackLanguages) => writeTrackPick(pageStorage(), movieId, pick), [movieId]);
  return { wanted, record };
}
