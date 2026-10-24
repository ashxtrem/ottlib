import type { KeyframeReader } from './KeyframeReader.js';
import { matroskaCues } from './matroskaCues.js';

/** Registered keyframe readers, tried in order. Add a container (e.g. an MP4 `stss` reader) by writing one file and listing it here. */
export const keyframeReaders: readonly KeyframeReader[] = [matroskaCues];

/** The first reader that handles this container, or null (no keyframe index: the caller transcodes). */
export function keyframeReaderFor(container: string | null, readers: readonly KeyframeReader[] = keyframeReaders): KeyframeReader | null {
  if (!container) return null;
  return readers.find((reader) => reader.supports(container)) ?? null;
}

/** Keyframe times (ms) of the file, or null when no reader handles the container or the index is unusable. */
export async function readKeyframes(path: string, container: string | null, readers: readonly KeyframeReader[] = keyframeReaders): Promise<number[] | null> {
  const reader = keyframeReaderFor(container, readers);
  return reader ? reader.read(path) : null;
}
