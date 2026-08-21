import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isWithinRoot, walkMovies } from './walker.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('walkMovies', () => {
  it('does not treat a path on another drive as inside an excluded folder', () => {
    if (process.platform !== 'win32') return;
    expect(isWithinRoot('D:\\vdo\\Excluded', 'G:\\hp\\Harry Potter.mkv')).toBe(false);
  });

  it('skips an excluded folder and all of its contents', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ottlib-walker-'));
    temporaryDirectories.push(root);
    const excluded = join(root, 'Downloads');
    const sibling = join(root, 'Downloads backup');
    await Promise.all([mkdir(join(excluded, 'nested'), { recursive: true }), mkdir(sibling, { recursive: true })]);
    await Promise.all([
      writeFile(join(root, 'Included.mkv'), ''),
      writeFile(join(excluded, 'Skipped.mkv'), ''),
      writeFile(join(excluded, 'nested', 'Also skipped.mkv'), ''),
      writeFile(join(sibling, 'Included sibling.mkv'), '')
    ]);

    const filenames: string[] = [];
    for await (const candidate of walkMovies(root, ['mkv'], [], [excluded])) filenames.push(candidate.filename);

    expect(filenames.sort()).toEqual(['Included sibling.mkv', 'Included.mkv']);
  });
});
