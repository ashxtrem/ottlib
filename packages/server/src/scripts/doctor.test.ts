import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/db.js';
import { FolderRepository } from '../repositories/folderRepository.js';

const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })); });

const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
const doctorScript = join(dirname(fileURLToPath(import.meta.url)), 'doctor.ts');

/** A temp app folder (config + data) with one library folder; no TMDb key, torrents off, no VERSION: no network. */
function appFolder(libraryFolder: (root: string) => string) {
  const root = mkdtempSync(join(tmpdir(), 'ottlib-doctor-')); directories.push(root);
  mkdirSync(join(root, 'config'));
  writeFileSync(join(root, 'config', 'config.json'), JSON.stringify({ appDataPath: './data' }));
  const db = createDatabase(join(root, 'data'));
  new FolderRepository(db).create(libraryFolder(root));
  db.close();
  return root;
}

const runDoctor = (cwd: string) => spawnSync(process.execPath, [tsxCli, doctorScript], { cwd, encoding: 'utf8', timeout: 60_000, env: { ...process.env, FFMPEG_PATH: join(cwd, 'no-ffmpeg') } });

describe('npm run doctor', () => {
  it('prints a line per check and exits 1 on a fail', () => {
    const result = runDoctor(appFolder((root) => join(root, 'gone')));
    expect(result.stdout).toMatch(/^FAIL Library folders: Cannot read .*gone/m);
    expect(result.stdout).toMatch(/^OK {3}Disk space:/m);
    expect(result.stdout).toMatch(/^WARN ffmpeg:/m);
    expect(result.stdout).toMatch(/^OK {3}Updates: Running from source\./m);
    expect(result.status).toBe(1);
  }, 60_000);

  it('exits 0 when nothing fails', () => {
    const result = runDoctor(appFolder((root) => { mkdirSync(join(root, 'movies')); return join(root, 'movies'); }));
    expect(result.stdout).toMatch(/^OK {3}Library folders:/m);
    expect(result.status).toBe(0);
  }, 60_000);
});
