import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readAppVersion } from './appVersion.js';

const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })); });
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'ottlib-version-')); directories.push(dir); return dir; };

describe('readAppVersion', () => {
  it('reads and trims the VERSION file', () => {
    const dir = temp(); writeFileSync(join(dir, 'VERSION'), '0.4.1\n');
    expect(readAppVersion(dir)).toBe('0.4.1');
  });

  it('is null without a VERSION file or with an empty one', () => {
    const dir = temp();
    expect(readAppVersion(dir)).toBeNull();
    writeFileSync(join(dir, 'VERSION'), '  \n');
    expect(readAppVersion(dir)).toBeNull();
  });
});
