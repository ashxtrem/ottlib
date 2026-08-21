import { readdir, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, resolve, relative, sep } from 'node:path';

export interface CandidateFile { path: string; filename: string; size: number; mtimeMs: number }

export function isWithinRoot(root: string, candidate: string): boolean {
  const relativePath = relative(resolve(root), resolve(candidate));
  return relativePath === '' || (!isAbsolute(relativePath) && !relativePath.startsWith(`..${sep}`) && relativePath !== '..' && !relativePath.includes(`..${sep}`));
}

export async function* walkMovies(root: string, extensions: string[], ignoredPatterns: string[], excludedFolders: string[] = []): AsyncGenerator<CandidateFile> {
  const resolvedRoot = resolve(root);
  const allowed = new Set(extensions.map((extension) => extension.replace(/^\./, '').toLowerCase()));
  const ignored = new Set(ignoredPatterns.map((pattern) => pattern.toLowerCase()));
  const excluded = excludedFolders.map((folder) => resolve(folder));
  const isExcluded = (path: string) => excluded.some((folder) => isWithinRoot(folder, path));

  async function* visit(directory: string): AsyncGenerator<CandidateFile> {
    if (isExcluded(directory)) return;
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(directory, entry.name);
      if (!isWithinRoot(resolvedRoot, fullPath) || isExcluded(fullPath) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !ignored.has(entry.name.toLowerCase())) yield* visit(fullPath);
      } else if (entry.isFile() && allowed.has(extname(entry.name).slice(1).toLowerCase())) {
        const details = await stat(fullPath);
        yield { path: resolve(fullPath), filename: entry.name, size: details.size, mtimeMs: details.mtimeMs };
      }
    }
  }
  yield* visit(resolvedRoot);
}
