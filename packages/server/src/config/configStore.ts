import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const bootstrapSchema = z.object({
  port: z.number().int().min(1).max(65535).default(8081),
  appDataPath: z.string().min(1).default('./data'),
  /** Advertise the server over mDNS so TV/mobile clients can discover it. */
  advertise: z.boolean().default(true)
});

export type BootstrapConfig = z.infer<typeof bootstrapSchema> & { absoluteAppDataPath: string };

export async function loadBootstrapConfig(rootPath = process.cwd()): Promise<BootstrapConfig> {
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
