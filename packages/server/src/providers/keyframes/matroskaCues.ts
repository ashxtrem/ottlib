import { keyframeLimits } from '../../config/keyframes.js';
import { childElements, maxHeaderBytes, openFileSource, readElementHeader, readFloat, readUnsigned, type ByteSource } from './ebml.js';
import { KeyframeCache } from './keyframeCache.js';
import type { KeyframeReader } from './KeyframeReader.js';

/** Matroska element IDs used here (with their length markers, as listed in the spec). */
export const mkv = {
  ebml: 0x1a45dfa3, segment: 0x18538067, seekHead: 0x114d9b74, seek: 0x4dbb, seekId: 0x53ab, seekPosition: 0x53ac,
  info: 0x1549a966, timecodeScale: 0x2ad7b1, duration: 0x4489, tracks: 0x1654ae6b, trackEntry: 0xae,
  trackNumber: 0xd7, trackType: 0x83, cues: 0x1c53bb6b, cuePoint: 0xbb, cueTime: 0xb3, cueTrackPositions: 0xb7,
  cueTrack: 0xf7, cluster: 0x1f43b675, chapters: 0x1043a770, tags: 0x1254c367, attachments: 0x1941a469,
} as const;

const levelOneIds = new Set<number>([mkv.seekHead, mkv.info, mkv.tracks, mkv.cues, mkv.cluster, mkv.chapters, mkv.tags, mkv.attachments]);
const videoTrackType = 1;
const defaultTimecodeScaleNs = 1_000_000;

interface LoadedElement { data: Buffer; size: number | null }

/** Reads one element at an absolute position: its header first, then its data (capped). */
async function loadElement(source: ByteSource, position: number, expectedId: number): Promise<LoadedElement | null> {
  const head = await source.read(position, maxHeaderBytes);
  const header = readElementHeader(head, 0);
  if (!header || header.id !== expectedId) return null;
  const dataStart = position + header.headerLength;
  const length = header.size ?? Math.min(source.size - dataStart, keyframeLimits.maxElementBytes);
  if (length > keyframeLimits.maxElementBytes) return null;
  return { data: await source.read(dataStart, length), size: header.size };
}

/** Children of a loaded level-1 element; an unknown-size one ends at the next level-1 ID. */
function childrenOf(element: LoadedElement) {
  return childElements(element.data, 0, element.data.length, element.size === null ? levelOneIds : undefined);
}

/** Absolute positions of the level-1 elements the SeekHead lists (relative to the Segment data start). */
function parseSeekHead(element: LoadedElement, segmentStart: number, into: Map<number, number[]>): void {
  for (const seek of childrenOf(element)) {
    if (seek.id !== mkv.seek) continue;
    let id: number | null = null; let position: number | null = null;
    for (const field of childElements(element.data, seek.start, seek.end)) {
      if (field.id === mkv.seekId) id = readUnsigned(element.data, field.start, field.end);
      if (field.id === mkv.seekPosition) position = readUnsigned(element.data, field.start, field.end);
    }
    if (id === null || position === null) continue;
    const list = into.get(id) ?? [];
    list.push(segmentStart + position);
    into.set(id, list);
  }
}

/** Finds the Segment, then walks level-1 headers (never Cluster data) and follows SeekHeads to place Info, Tracks, Cues. */
async function locateElements(source: ByteSource): Promise<Map<number, number[]> | null> {
  const head = await source.read(0, 64);
  const ebml = readElementHeader(head, 0);
  if (!ebml || ebml.id !== mkv.ebml || ebml.size === null) return null;
  const segmentPosition = ebml.headerLength + ebml.size;
  const segmentHead = readElementHeader(await source.read(segmentPosition, maxHeaderBytes), 0);
  if (!segmentHead || segmentHead.id !== mkv.segment) return null;
  const segmentStart = segmentPosition + segmentHead.headerLength;

  const found = new Map<number, number[]>();
  const add = (id: number, position: number) => found.set(id, [...(found.get(id) ?? []), position]);
  let position = segmentStart;
  for (let i = 0; i < keyframeLimits.maxTopLevelElements && position < source.size; i++) {
    const header = readElementHeader(await source.read(position, maxHeaderBytes), 0);
    if (!header || header.id === mkv.cluster || header.size === null) break;
    add(header.id, position);
    position += header.headerLength + header.size;
  }

  const visited = new Set<number>();
  for (let pending = found.get(mkv.seekHead) ?? []; pending.length > 0; pending = (found.get(mkv.seekHead) ?? []).filter((p) => !visited.has(p))) {
    for (const seekHeadPosition of pending) {
      visited.add(seekHeadPosition);
      const element = await loadElement(source, seekHeadPosition, mkv.seekHead);
      if (element) parseSeekHead(element, segmentStart, found);
    }
  }
  return found;
}

async function firstElement(source: ByteSource, positions: number[] | undefined, id: number): Promise<LoadedElement | null> {
  for (const position of new Set(positions ?? [])) {
    const element = await loadElement(source, position, id);
    if (element) return element;
  }
  return null;
}

function parseInfo(element: LoadedElement | null): { scaleNs: number; duration: number | null } {
  let scaleNs = defaultTimecodeScaleNs; let duration: number | null = null;
  if (!element) return { scaleNs, duration };
  for (const field of childrenOf(element)) {
    if (field.id === mkv.timecodeScale) scaleNs = readUnsigned(element.data, field.start, field.end) || defaultTimecodeScaleNs;
    if (field.id === mkv.duration) duration = readFloat(element.data, field.start, field.end);
  }
  return { scaleNs, duration };
}

function firstVideoTrack(element: LoadedElement): number | null {
  for (const entry of childrenOf(element)) {
    if (entry.id !== mkv.trackEntry) continue;
    let number: number | null = null; let type: number | null = null;
    for (const field of childElements(element.data, entry.start, entry.end)) {
      if (field.id === mkv.trackNumber) number = readUnsigned(element.data, field.start, field.end);
      if (field.id === mkv.trackType) type = readUnsigned(element.data, field.start, field.end);
    }
    if (type === videoTrackType && number !== null) return number;
  }
  return null;
}

/** CueTimes (in timecode units) of cue points that index the given track. */
function cueTimes(element: LoadedElement, track: number): number[] {
  const times: number[] = [];
  for (const point of childrenOf(element)) {
    if (point.id !== mkv.cuePoint) continue;
    let time: number | null = null; let matches = false;
    for (const field of childElements(element.data, point.start, point.end)) {
      if (field.id === mkv.cueTime) time = readUnsigned(element.data, field.start, field.end);
      if (field.id !== mkv.cueTrackPositions) continue;
      for (const position of childElements(element.data, field.start, field.end)) {
        if (position.id === mkv.cueTrack && readUnsigned(element.data, position.start, position.end) === track) matches = true;
      }
    }
    if (time !== null && matches) times.push(time);
  }
  return times;
}

/** Keyframe times (ms) of the first video track from a Matroska source, or null without a usable Cues index. */
export async function readMatroskaKeyframes(source: ByteSource): Promise<number[] | null> {
  const found = await locateElements(source);
  if (!found) return null;
  const cues = await firstElement(source, found.get(mkv.cues), mkv.cues);
  const tracks = await firstElement(source, found.get(mkv.tracks), mkv.tracks);
  if (!cues || !tracks) return null;
  const track = firstVideoTrack(tracks);
  if (track === null) return null;
  const { scaleNs, duration } = parseInfo(await firstElement(source, found.get(mkv.info), mkv.info));
  const toMs = (units: number) => Math.round((units * scaleNs) / 1_000_000);
  const times = [...new Set(cueTimes(cues, track).map(toMs))].sort((a, b) => a - b);
  if (times.length === 0) return null;
  const durationMs = duration !== null && duration > 0 ? toMs(duration) : null;
  const averageGap = durationMs !== null ? durationMs / times.length
    : times.length > 1 ? (times[times.length - 1] - times[0]) / (times.length - 1) : Number.POSITIVE_INFINITY;
  return averageGap > keyframeLimits.maxAverageGapMs ? null : times;
}

export function createMatroskaCuesReader(openSource: (path: string) => Promise<ByteSource> = openFileSource): KeyframeReader {
  const cache = new KeyframeCache(keyframeLimits.cacheEntries);
  return {
    name: 'matroskaCues',
    supports: (container) => ['mkv', 'webm', 'matroska'].includes(container.trim().toLowerCase()),
    read: (path) => cache.getOrRead(path, async () => {
      const source = await openSource(path);
      try { return await readMatroskaKeyframes(source); } finally { await source.close(); }
    }),
  };
}

export const matroskaCues = createMatroskaCuesReader();
