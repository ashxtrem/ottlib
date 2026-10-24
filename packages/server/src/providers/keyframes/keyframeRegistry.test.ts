import { describe, expect, it, vi } from 'vitest';
import type { KeyframeReader } from './KeyframeReader.js';
import { keyframeReaderFor, keyframeReaders, readKeyframes } from './keyframeRegistry.js';

describe('keyframeRegistry', () => {
  it('lists matroskaCues first', () => {
    expect(keyframeReaders[0].name).toBe('matroskaCues');
    expect(keyframeReaderFor('MKV')?.name).toBe('matroskaCues');
  });

  it('returns null for a container no reader handles', async () => {
    expect(keyframeReaderFor('MP4')).toBeNull();
    expect(keyframeReaderFor(null)).toBeNull();
    expect(await readKeyframes('/x.mp4', 'MP4')).toBeNull();
  });

  it('asks the first reader that supports the container', async () => {
    const mp4: KeyframeReader = { name: 'mp4Stss', supports: (c) => c === 'MP4', read: vi.fn(async () => [0, 2000]) };
    expect(await readKeyframes('/x.mp4', 'MP4', [...keyframeReaders, mp4])).toEqual([0, 2000]);
  });
});
