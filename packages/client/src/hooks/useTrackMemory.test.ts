import { describe, expect, it } from 'vitest';
import { TRACK_CHOICES_KEY, TRACK_LANGUAGES_KEY, readRememberedLanguages, writeTrackPick } from './useTrackMemory';

function fakeStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

const broken = {
  getItem: (): string | null => { throw new Error('blocked'); },
  setItem: (): void => { throw new Error('full'); }
};

describe('track memory storage', () => {
  it('stores picks per title and as the last-chosen languages, under their own keys', () => {
    const storage = fakeStorage();
    writeTrackPick(storage, 7, { audio: 'hin' });
    writeTrackPick(storage, 7, { subtitle: 'en' });
    writeTrackPick(storage, 9, { subtitle: null });
    expect(JSON.parse(storage.data.get(TRACK_CHOICES_KEY)!)).toEqual({ 7: { audio: 'hin', subtitle: 'en' }, 9: { subtitle: null } });
    expect(JSON.parse(storage.data.get(TRACK_LANGUAGES_KEY)!)).toEqual({ audio: 'hin', subtitle: null });
    expect(readRememberedLanguages(storage, 7)).toEqual({ audio: 'hin', subtitle: 'en' });
    // A new title starts with the last-chosen languages.
    expect(readRememberedLanguages(storage, 12)).toEqual({ audio: 'hin', subtitle: null });
  });

  it('ignores a pick without a language and survives blocked storage', () => {
    const storage = fakeStorage();
    writeTrackPick(storage, 1, { audio: undefined });
    expect(storage.data.size).toBe(0);
    expect(readRememberedLanguages(broken, 1)).toEqual({});
    expect(() => writeTrackPick(broken, 1, { audio: 'en' })).not.toThrow();
  });
});
