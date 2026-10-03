import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { movieHash } from './movieHash.js';

it('computes the OpenSubtitles hash from the ends, size, and unsigned overflow', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'subtitle-hash-'));
  try {
    const file = join(folder, 'video.mkv');
    await writeFile(file, Buffer.alloc(128 * 1024));
    expect(await movieHash(file)).toBe('0000000000020000');
    await writeFile(file, Buffer.alloc(128 * 1024, 255));
    expect(await movieHash(file)).toBe('000000000001c000');
    await writeFile(file, 'too small'); expect(await movieHash(file)).toBeUndefined();
  } finally { await rm(folder, { recursive: true, force: true }); }
});
