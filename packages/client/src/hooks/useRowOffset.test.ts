import { describe, expect, it } from 'vitest';
import { clearRowOffsets, readRowOffsets, rowOffsetsStorageKey, writeRowOffset } from './useRowOffset';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
}

const brokenStorage = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
  removeItem: () => { throw new Error('blocked'); }
};

describe('home row offsets', () => {
  it('keeps each row’s sideways position by row key', () => {
    const storage = memoryStorage();
    writeRowOffset('recent', 480.4, storage);
    writeRowOffset('shelf-2', 120, storage);
    expect(readRowOffsets(storage)).toEqual({ recent: 480, 'shelf-2': 120 });
    expect(storage.values.has(rowOffsetsStorageKey)).toBe(true);
    expect(rowOffsetsStorageKey).toBe('ottlib-home-row-offsets');
  });

  it('forgets a row scrolled back to its start', () => {
    const storage = memoryStorage();
    writeRowOffset('recent', 300, storage);
    writeRowOffset('recent', 0, storage);
    expect(readRowOffsets(storage)).toEqual({});
  });

  it('clears every row for a fresh visit', () => {
    const storage = memoryStorage();
    writeRowOffset('recent', 300, storage);
    clearRowOffsets(storage);
    expect(readRowOffsets(storage)).toEqual({});
  });

  it('ignores bad saved values', () => {
    const storage = memoryStorage();
    storage.setItem(rowOffsetsStorageKey, '{"recent":"x","continue":-4,"unwatched":90}');
    expect(readRowOffsets(storage)).toEqual({ unwatched: 90 });
    storage.setItem(rowOffsetsStorageKey, 'not json');
    expect(readRowOffsets(storage)).toEqual({});
    storage.setItem(rowOffsetsStorageKey, '[1,2]');
    expect(readRowOffsets(storage)).toEqual({});
  });

  it('survives blocked storage', () => {
    expect(readRowOffsets(brokenStorage)).toEqual({});
    expect(() => writeRowOffset('recent', 10, brokenStorage)).not.toThrow();
    expect(() => clearRowOffsets(brokenStorage)).not.toThrow();
  });
});
