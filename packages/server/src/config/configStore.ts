import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';

const bootstrapSchema = z.object({
  port: z.number().int().min(1).max(65535).default(8081),
  appDataPath: z.string().min(1).default('./data'),
  /** Advertise the server over mDNS so TV/mobile clients can discover it. */
  advertise: z.boolean().default(true)
});

export type BootstrapConfig = z.infer<typeof bootstrapSchema> & { absoluteAppDataPath: string };

const hasConfig = (directory: string) => existsSync(join(directory, 'config', 'config.json')) || existsSync(join(directory, 'config', 'config.example.json'));

/**
 * The folder that holds `config/` (and, by default, `data/`): `start` or the nearest parent with a `config/config.json`
 * or `config/config.example.json`, else `start` itself. `npm start` and the release bundle run in that folder already;
 * `npm run dev` and `npm run reset-pins` run in packages/server and find the repository root from there, so the server
 * and the CLI always open the same library.
 */
export function resolveAppRoot(start = process.cwd()): string {
  for (let directory = resolve(start); ; directory = dirname(directory)) {
    if (hasConfig(directory)) return directory;
    if (dirname(directory) === directory) return resolve(start);
  }
}

export async function loadBootstrapConfig(rootPath = resolveAppRoot()): Promise<BootstrapConfig> {
  const configPath = resolve(rootPath, 'config', 'config.json');
  const examplePath = resolve(rootPath, 'config', 'config.example.json');
  try { await readFile(configPath); } catch {
    await mkdir(dirname(configPath), { recursive: true });
    await copyFile(examplePath, configPath);
  }
  const parsed = bootstrapSchema.parse(JSON.parse(await readFile(configPath, 'utf8')));
  const absoluteAppDataPath = resolve(rootPath, parsed.appDataPath);
  await mkdir(absoluteAppDataPath, { recursive: true });
  return { ...parsed, absoluteAppDataPath };
}
