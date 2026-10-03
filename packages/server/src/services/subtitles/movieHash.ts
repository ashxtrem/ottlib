import { open } from 'node:fs/promises';

/** OpenSubtitles hash: size plus little-endian words from the first and last 64 KiB. */
export async function movieHash(path: string): Promise<string | undefined> {
  const file = await open(path, 'r');
  try {
    const { size } = await file.stat();
    if (size < 128 * 1024) return undefined;
    let hash = BigInt(size);
    for (const position of [0, size - 65536]) {
      const buffer = Buffer.alloc(65536);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, position);
      if (bytesRead !== buffer.length) return undefined;
      for (let offset = 0; offset < buffer.length; offset += 8) hash += buffer.readBigUInt64LE(offset);
    }
    return BigInt.asUintN(64, hash).toString(16).padStart(16, '0');
  } finally { await file.close(); }
}
