import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ByteSource } from './ebml.js';
import { createMatroskaCuesReader, mkv, readMatroskaKeyframes } from './matroskaCues.js';

function idBytes(id: number): Buffer {
  const hex = id.toString(16);
  return Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex');
}

/** Size VINT: minimal length unless `length` is forced; null writes the 8-byte unknown-size marker. */
function sizeBytes(size: number | null, length?: number): Buffer {
  if (size === null) return Buffer.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  let bytes = length ?? 1;
  while (!length && size >= 2 ** (7 * bytes) - 1) bytes++;
  const out = Buffer.alloc(bytes);
  let rest = size;
  for (let i = bytes - 1; i >= 0; i--) { out[i] = rest % 256; rest = Math.floor(rest / 256); }
  out[0] |= 0x80 >> (bytes - 1);
  return out;
}

const header = (id: number, size: number | null) => Buffer.concat([idBytes(id), sizeBytes(size)]);
const el = (id: number, ...children: Buffer[]) => { const data = Buffer.concat(children); return Buffer.concat([header(id, data.length), data]); };
function uint(id: number, value: number, width = 0): Buffer {
  let bytes = width || 1;
  while (!width && value >= 2 ** (8 * bytes)) bytes++;
  const data = Buffer.alloc(bytes); let rest = value;
  for (let i = bytes - 1; i >= 0; i--) { data[i] = rest % 256; rest = Math.floor(rest / 256); }
  return Buffer.concat([idBytes(id), sizeBytes(bytes), data]);
}
const double = (id: number, value: number) => { const data = Buffer.alloc(8); data.writeDoubleBE(value); return Buffer.concat([idBytes(id), sizeBytes(8), data]); };

const ebmlHeader = el(mkv.ebml, el(0x4282, Buffer.from('matroska')));
const tracks = el(mkv.tracks,
  el(mkv.trackEntry, uint(mkv.trackNumber, 1), uint(mkv.trackType, 2)),
  el(mkv.trackEntry, uint(mkv.trackNumber, 2), uint(mkv.trackType, 1)));
const info = (durationUnits: number, scale?: number) =>
  el(mkv.info, ...(scale ? [uint(mkv.timecodeScale, scale)] : []), double(mkv.duration, durationUnits));
const cuePoint = (time: number, track: number) => el(mkv.cuePoint, uint(mkv.cueTime, time), el(mkv.cueTrackPositions, uint(mkv.cueTrack, track), uint(0xf1, 1234)));
const cues = (points: Array<[number, number]>) => el(mkv.cues, ...points.map(([time, track]) => cuePoint(time, track)));

/** SeekHead with 8-byte positions so its size does not depend on the positions. */
function seekHead(entries: Array<[number, number]>): Buffer {
  return el(mkv.seekHead, ...entries.map(([id, position]) => el(mkv.seek, el(mkv.seekId, idBytes(id)), uint(mkv.seekPosition, position, 8))));
}

/** Segment (unknown size) holding a SeekHead pointing at the given level-1 elements, in order. */
function buildFile(elements: Array<[number, Buffer]>, seekIds = elements.map(([id]) => id).filter((id) => id !== mkv.cluster)): Buffer {
  const placeholder = seekHead(seekIds.map((id) => [id, 0]));
  const positions = new Map<number, number>();
  let offset = placeholder.length;
  for (const [id, data] of elements) { if (!positions.has(id)) positions.set(id, offset); offset += data.length; }
  const head = seekHead(seekIds.map((id) => [id, positions.get(id) ?? 0]));
  return Buffer.concat([ebmlHeader, header(mkv.segment, null), head, ...elements.map(([, data]) => data)]);
}

function bufferSource(buffer: Buffer): ByteSource & { bytesRead: number } {
  return {
    size: buffer.length, bytesRead: 0,
    async read(position, length) { const out = buffer.subarray(position, Math.min(buffer.length, position + length)); this.bytesRead += out.length; return out; },
    async close() {},
  };
}

const cluster = el(mkv.cluster, uint(0xe7, 0), Buffer.alloc(500));
const everyTwoSeconds: Array<[number, number]> = [[0, 2], [2000, 2], [2000, 1], [4000, 2], [5000, 1], [6000, 2], [8000, 2]];

describe('readMatroskaKeyframes', () => {
  it('reads the video track CueTimes through the SeekHead, Cues after the Clusters', async () => {
    const file = buildFile([[mkv.info, info(10_000)], [mkv.tracks, tracks], [mkv.cluster, cluster], [mkv.cues, cues(everyTwoSeconds)]]);
    expect(await readMatroskaKeyframes(bufferSource(file))).toEqual([0, 2000, 4000, 6000, 8000]);
  });

  it('scales CueTimes by the TimecodeScale', async () => {
    const points: Array<[number, number]> = [[0, 2], [20_000, 2], [40_000, 2]];
    const file = buildFile([[mkv.info, info(60_000, 100_000)], [mkv.tracks, tracks], [mkv.cluster, cluster], [mkv.cues, cues(points)]]);
    expect(await readMatroskaKeyframes(bufferSource(file))).toEqual([0, 2000, 4000]);
  });

  it('finds Cues placed before the Clusters without a SeekHead entry', async () => {
    const file = buildFile([[mkv.info, info(10_000)], [mkv.tracks, tracks], [mkv.cues, cues(everyTwoSeconds)], [mkv.cluster, cluster]], [mkv.info, mkv.tracks]);
    expect(await readMatroskaKeyframes(bufferSource(file))).toEqual([0, 2000, 4000, 6000, 8000]);
  });

  it('follows a second SeekHead at the end of the file', async () => {
    const infoEl = info(10_000); const cuesEl = cues(everyTwoSeconds);
    const headLength = seekHead([[mkv.info, 0], [mkv.tracks, 0], [mkv.seekHead, 0]]).length;
    const tailHeadAt = headLength + infoEl.length + tracks.length + cluster.length;
    const cuesAt = tailHeadAt + seekHead([[mkv.cues, 0]]).length;
    const file = Buffer.concat([ebmlHeader, header(mkv.segment, null),
      seekHead([[mkv.info, headLength], [mkv.tracks, headLength + infoEl.length], [mkv.seekHead, tailHeadAt]]),
      infoEl, tracks, cluster, seekHead([[mkv.cues, cuesAt]]), cuesEl]);
    expect(await readMatroskaKeyframes(bufferSource(file))).toEqual([0, 2000, 4000, 6000, 8000]);
  });

  it('returns null without Cues', async () => {
    const file = buildFile([[mkv.info, info(10_000)], [mkv.tracks, tracks], [mkv.cluster, cluster]]);
    expect(await readMatroskaKeyframes(bufferSource(file))).toBeNull();
  });

  it('returns null when the average keyframe gap is over 10 s', async () => {
    const sparse: Array<[number, number]> = [[0, 2], [12_000, 2], [24_000, 2], [36_000, 2]];
    const file = buildFile([[mkv.info, info(48_000)], [mkv.tracks, tracks], [mkv.cluster, cluster], [mkv.cues, cues(sparse)]]);
    expect(await readMatroskaKeyframes(bufferSource(file))).toBeNull();
  });

  it('returns null for a file that is not Matroska', async () => {
    expect(await readMatroskaKeyframes(bufferSource(Buffer.from('not a matroska file at all')))).toBeNull();
  });

  it('seeks to Cues behind a 3 GB Cluster without reading it', async () => {
    const clusterSize = 3 * 1024 ** 3;
    const prefixHead = seekHead([[mkv.info, 0], [mkv.tracks, 0], [mkv.cues, 0]]);
    const infoEl = info(7_200_000); const clusterHead = header(mkv.cluster, clusterSize);
    const cuesPosition = prefixHead.length + infoEl.length + tracks.length + clusterHead.length + clusterSize;
    const head = seekHead([[mkv.info, prefixHead.length], [mkv.tracks, prefixHead.length + infoEl.length], [mkv.cues, cuesPosition]]);
    const prefix = Buffer.concat([ebmlHeader, header(mkv.segment, null), head, infoEl, tracks, clusterHead]);
    const points: Array<[number, number]> = Array.from({ length: 3600 }, (_, i) => [i * 2000, 2]);
    const tail = cues(points);
    const tailStart = ebmlHeader.length + header(mkv.segment, null).length + cuesPosition;
    const source = {
      size: tailStart + tail.length, bytesRead: 0,
      async read(position: number, length: number) {
        const out = Buffer.alloc(Math.max(0, Math.min(length, this.size - position)));
        prefix.copy(out, 0, Math.min(position, prefix.length), Math.min(position + length, prefix.length));
        if (position + length > tailStart) tail.copy(out, Math.max(0, tailStart - position), Math.max(0, position - tailStart));
        this.bytesRead += out.length;
        return out;
      },
      async close() {},
    };
    const keyframes = await readMatroskaKeyframes(source);
    expect(keyframes).toHaveLength(3600);
    expect(keyframes?.[1]).toBe(2000);
    expect(source.bytesRead).toBeLessThan(prefix.length + tail.length + 1024);
  });
});

describe('createMatroskaCuesReader', () => {
  let dir: string | null = null;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = null; });

  it('supports Matroska containers only', () => {
    const reader = createMatroskaCuesReader();
    expect(reader.supports('MKV')).toBe(true);
    expect(reader.supports('WebM')).toBe(true);
    expect(reader.supports('MP4')).toBe(false);
  });

  it('reads a file once and serves repeats from the cache', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ottlib-keyframes-'));
    const path = join(dir, 'movie.mkv');
    writeFileSync(path, buildFile([[mkv.info, info(10_000)], [mkv.tracks, tracks], [mkv.cluster, cluster], [mkv.cues, cues(everyTwoSeconds)]]));
    const { openFileSource } = await import('./ebml.js');
    const open = vi.fn(openFileSource);
    const reader = createMatroskaCuesReader(open);
    expect(await reader.read(path)).toEqual([0, 2000, 4000, 6000, 8000]);
    expect(await reader.read(path)).toEqual([0, 2000, 4000, 6000, 8000]);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
