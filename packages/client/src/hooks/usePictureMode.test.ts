import { describe, expect, it } from 'vitest';
import { PICTURE_DEFAULT_KEY, PICTURE_MODES_KEY, readPictureDefault, readPictureModes, writePictureDefault, writePictureMode } from './usePictureMode';
import { pageStorage } from '../utils/pageStorage';
import { parsePictureDefault, parsePictureModes, pictureMenuItems, pictureModeFor } from '../utils/pictureModes';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

const broken = {
  getItem: (): string | null => { throw new Error('blocked'); },
  setItem: (): void => { throw new Error('full'); }
};

describe('picture mode storage', () => {
  it('remembers a mode per title and a default, under their own keys', () => {
    const storage = fakeStorage();
    writePictureMode(storage, 7, 'Zoom');
    writePictureMode(storage, 9, 'Cinema');
    writePictureMode(storage, 7, 'SmartFill');
    writePictureDefault(storage, 'Stretch');
    expect(JSON.parse(storage.data.get(PICTURE_MODES_KEY)!)).toEqual({ 7: 'SmartFill', 9: 'Cinema' });
    expect(storage.data.get(PICTURE_DEFAULT_KEY)).toBe('Stretch');
    expect(readPictureModes(storage)).toEqual({ 7: 'SmartFill', 9: 'Cinema' });
    expect(readPictureDefault(storage)).toBe('Stretch');
  });

  it('uses a title\'s own mode, else the default, else Fit', () => {
    const modes = { 7: 'Zoom' } as const;
    expect(pictureModeFor(modes, 7, 'Stretch')).toBe('Zoom');
    expect(pictureModeFor(modes, 8, 'Stretch')).toBe('Stretch');
    expect(readPictureDefault(fakeStorage())).toBe('Fit');
  });

  it('survives blocked storage and corrupt values', () => {
    expect(readPictureModes(broken)).toEqual({});
    expect(readPictureDefault(broken)).toBe('Fit');
    expect(() => writePictureMode(broken, 1, 'Zoom')).not.toThrow();
    expect(() => writePictureDefault(broken, 'Zoom')).not.toThrow();
    expect(parsePictureModes('not json')).toEqual({});
    expect(parsePictureModes('[1,2]')).toEqual({});
    expect(parsePictureModes('{"1":"Zoom","2":"Bogus"}')).toEqual({ 1: 'Zoom' });
    expect(parsePictureDefault('Bogus')).toBe('Fit');
  });
});

describe('blocked browser storage', () => {
  it('has no store to hand out, yet a picked mode still applies for the session', () => {
    // The node test environment has no `window`, which is the same failure as a SecurityError on access.
    const storage = pageStorage();
    writePictureMode(storage, 3, 'Zoom');
    writePictureDefault(storage, 'Stretch');
    expect(readPictureModes(pageStorage())).toEqual({ 3: 'Zoom' });
    expect(readPictureDefault(pageStorage())).toBe('Stretch');
  });
});

describe('pictureMenuItems', () => {
  it('lists the 7 modes with Android\'s labels and checks the current one', () => {
    const items = pictureMenuItems('SmartFill');
    expect(items.map((item) => item.label)).toEqual(['Fit', 'Zoom', 'Stretch', 'Smart fill', '16:9', '4:3', '2.39:1']);
    expect(items.filter((item) => item.selected).map((item) => item.mode)).toEqual(['SmartFill']);
  });
});
