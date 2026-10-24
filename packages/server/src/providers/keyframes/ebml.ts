import { open } from 'node:fs/promises';

/** Random-access bytes of a file; tests supply in-memory or counting sources. */
export interface ByteSource {
  size: number;
  read(position: number, length: number): Promise<Buffer>;
  close(): Promise<void>;
}

export interface ElementHeader {
  id: number;
  /** Data size in bytes, or null for an unknown-size element. */
  size: number | null;
  headerLength: number;
}

export interface ChildElement { id: number; start: number; end: number }

/** Bytes needed to hold any element header: a 4-byte ID plus an 8-byte size. */
export const maxHeaderBytes = 12;

export async function openFileSource(path: string): Promise<ByteSource> {
  const handle = await open(path, 'r');
  const { size } = await handle.stat();
  return {
    size,
    async read(position, length) {
      const wanted = Math.max(0, Math.min(length, size - position));
      const buffer = Buffer.alloc(wanted);
      let done = 0;
      while (done < wanted) {
        const { bytesRead } = await handle.read(buffer, done, wanted - done, position + done);
        if (bytesRead === 0) break;
        done += bytesRead;
      }
      return buffer.subarray(0, done);
    },
    close: () => handle.close(),
  };
}

/** Length in bytes of the VINT starting with this byte (1-8), or 0 when invalid. */
function vintLength(first: number): number {
  for (let length = 1; length <= 8; length++) if (first & (0x80 >> (length - 1))) return length;
  return 0;
}

/** Element ID, kept with its length marker bits (the form the Matroska spec lists, e.g. 0x1A45DFA3). */
export function readElementId(buffer: Buffer, offset: number): { id: number; length: number } | null {
  if (offset >= buffer.length) return null;
  const length = vintLength(buffer[offset]);
  if (length === 0 || length > 4 || offset + length > buffer.length) return null;
  let id = 0;
  for (let i = 0; i < length; i++) id = id * 256 + buffer[offset + i];
  return { id, length };
}

/** Data size VINT with its marker removed; null value when every value bit is set (unknown size). */
export function readElementSize(buffer: Buffer, offset: number): { size: number | null; length: number } | null {
  if (offset >= buffer.length) return null;
  const length = vintLength(buffer[offset]);
  if (length === 0 || offset + length > buffer.length) return null;
  let size = buffer[offset] & (0xff >> length);
  let allOnes = size === 0xff >> length;
  for (let i = 1; i < length; i++) {
    const byte = buffer[offset + i];
    if (byte !== 0xff) allOnes = false;
    size = size * 256 + byte;
  }
  if (allOnes) return { size: null, length };
  return Number.isSafeInteger(size) ? { size, length } : null;
}

export function readElementHeader(buffer: Buffer, offset: number): ElementHeader | null {
  const id = readElementId(buffer, offset);
  if (!id) return null;
  const size = readElementSize(buffer, offset + id.length);
  if (!size) return null;
  return { id: id.id, size: size.size, headerLength: id.length + size.length };
}

/**
 * Children of a master element whose data spans [start, end) of the buffer. An unknown-size child runs to `end`.
 * Stops at a malformed header or at an ID in `stopIds` (a level-1 ID ends an unknown-size parent).
 */
export function* childElements(buffer: Buffer, start: number, end: number, stopIds?: ReadonlySet<number>): Generator<ChildElement> {
  let offset = start;
  while (offset < end) {
    const header = readElementHeader(buffer, offset);
    if (!header || stopIds?.has(header.id)) return;
    const dataStart = offset + header.headerLength;
    const dataEnd = header.size === null ? end : dataStart + header.size;
    if (dataEnd > end) return;
    yield { id: header.id, start: dataStart, end: dataEnd };
    offset = dataEnd;
  }
}

export function readUnsigned(buffer: Buffer, start: number, end: number): number {
  let value = 0;
  for (let i = start; i < end; i++) value = value * 256 + buffer[i];
  return value;
}

export function readFloat(buffer: Buffer, start: number, end: number): number | null {
  if (end - start === 4) return buffer.readFloatBE(start);
  if (end - start === 8) return buffer.readDoubleBE(start);
  return null;
}
