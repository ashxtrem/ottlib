import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { folderReadable, libraryFoldersCheck } from './libraryFoldersCheck.js';

describe('library-folders check', () => {
  it('is ok when every folder is readable', async () => {
    const result = await libraryFoldersCheck(() => ['/a', '/b'], async () => true).run();
    expect(result).toMatchObject({ state: 'ok', message: '2 folders readable.' });
  });

  it('fails and names a folder that is gone', async () => {
    const result = await libraryFoldersCheck(() => ['/a', '/gone'], async (path) => path !== '/gone').run();
    expect(result.state).toBe('fail');
    expect(result.message).toContain('/gone');
    expect(result.message).not.toContain('/a');
    expect(result.fix).toBeTruthy();
  });

  it('folderReadable is true for a real folder and false for a missing one', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ottlib-folder-check-'));
    try {
      expect(await folderReadable(dir)).toBe(true);
      expect(await folderReadable(join(dir, 'missing'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
