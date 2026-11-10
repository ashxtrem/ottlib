import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Structure checks: the layering and file-size rules from AGENTS.md, enforced on the real tree.
// Rule logic lives in small pure functions so the failure cases can be tested with synthetic input.

const MAX_LINES = 700;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.gradle', '.git', 'coverage']);

/** Route files that still import a repository as a value. This list only shrinks. */
const ROUTE_REPOSITORY_ALLOWLIST = ['library.ts', 'playbackProgress.ts', 'scan.ts'];

const ALLOWED_INDEX_FILES = ['packages/server/src/index.ts', 'packages/shared/src/index.ts'];

interface ImportRef {
  clause: string;
  specifier: string;
}

export function parseImports(text: string): ImportRef[] {
  const out: ImportRef[] = [];
  const re = /^import\s+([^;'"]*?)\s*from\s*['"]([^'"]+)['"]/gm;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push({ clause: m[1], specifier: m[2] });
  return out;
}

/** True when the import clause only brings in types (`type X`, `{ type A, type B }`). */
export function isTypeOnlyClause(clause: string): boolean {
  const c = clause.trim();
  if (/^type\s/.test(c)) return true;
  if (!c.startsWith('{')) return false;
  const names = c
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return names.length > 0 && names.every((n) => /^type\s/.test(n));
}

function importsFrom(text: string, dir: string): ImportRef[] {
  const prefix = new RegExp(`^\\.\\./${dir}/`);
  return parseImports(text).filter((i) => prefix.test(i.specifier));
}

/** Rule 1: routes never import from ../db/. */
export function routeDbViolations(text: string): string[] {
  return importsFrom(text, 'db').map((i) => `imports ${i.specifier}`);
}

export function hasRepositoryValueImport(text: string): boolean {
  return importsFrom(text, 'repositories').some((i) => !isTypeOnlyClause(i.clause));
}

/** Rule 2: routes import no repository value, unless allowlisted; an allowlisted file must still need its entry. */
export function routeRepositoryViolations(text: string, allowlisted: boolean): string[] {
  const hasValue = hasRepositoryValueImport(text);
  if (allowlisted) return hasValue ? [] : ['no longer imports a repository value: remove it from the allowlist'];
  return importsFrom(text, 'repositories')
    .filter((i) => !isTypeOnlyClause(i.clause))
    .map((i) => `imports a value from ${i.specifier}`);
}

/** Rule 3: services never import fastify. */
export function serviceFastifyViolations(text: string): string[] {
  return parseImports(text)
    .filter((i) => i.specifier === 'fastify' || i.specifier.startsWith('fastify/') || i.specifier.startsWith('@fastify/'))
    .map((i) => `imports ${i.specifier}`);
}

/** Rule 4: raw SQL entry points only in repositories/ and db/. */
export function rawSqlViolations(text: string): string[] {
  const out: string[] = [];
  if (/\.prepare\(/.test(text)) out.push('calls .prepare(');
  if (/\.pragma\(/.test(text)) out.push('calls .pragma(');
  return out;
}

/** Rule 5: no source file over the line limit. */
export function lineCountViolations(text: string, max = MAX_LINES): string[] {
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.length > max ? [`has ${lines.length} lines (limit ${max})`] : [];
}

/** Rule 6: only the two entry points may be named index.ts. */
export function indexFileViolations(relPath: string, allowed: string[] = ALLOWED_INDEX_FILES): string[] {
  return path.posix.basename(relPath) === 'index.ts' && !allowed.includes(relPath)
    ? ['index.ts barrel files are not allowed']
    : [];
}

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) out.push(...walk(path.join(dir, e.name), exts));
    } else if (exts.some((x) => e.name.endsWith(x))) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rel = (abs: string) => path.relative(repoRoot, abs).split(path.sep).join('/');
const read = (abs: string) => readFileSync(abs, 'utf8');

function subdirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

function packageSrcDirs(): string[] {
  return subdirs(path.join(repoRoot, 'packages')).map((d) => path.join(d, 'src'));
}

function androidSrcDirs(): string[] {
  const android = path.join(repoRoot, 'apps/android');
  return [...subdirs(android), ...subdirs(path.join(android, 'core'))].map((d) => path.join(d, 'src'));
}

function collect(files: string[], check: (relPath: string, text: string) => string[]): string[] {
  return files.flatMap((f) => check(rel(f), read(f)).map((v) => `${rel(f)}: ${v}`));
}

const serverSrc = path.join(repoRoot, 'packages/server/src');
const isTest = (f: string) => f.endsWith('.test.ts');

describe('structure rules on the real tree', () => {
  it('routes do not import from ../db/ (rule 1)', () => {
    const files = walk(path.join(serverSrc, 'routes'), ['.ts']).filter((f) => !isTest(f));
    expect(collect(files, (_p, t) => routeDbViolations(t))).toEqual([]);
  });

  it('routes import no repository values outside the allowlist, and the allowlist has no stale entries (rule 2)', () => {
    const files = walk(path.join(serverSrc, 'routes'), ['.ts']).filter((f) => !isTest(f));
    const names = files.map((f) => path.basename(f));
    expect(ROUTE_REPOSITORY_ALLOWLIST.filter((n) => !names.includes(n))).toEqual([]);
    const violations = collect(files, (p, t) => routeRepositoryViolations(t, ROUTE_REPOSITORY_ALLOWLIST.includes(path.posix.basename(p))));
    expect(violations).toEqual([]);
  });

  it('services do not import fastify (rule 3)', () => {
    const files = walk(path.join(serverSrc, 'services'), ['.ts']);
    expect(collect(files, (_p, t) => serviceFastifyViolations(t))).toEqual([]);
  });

  it('.prepare( and .pragma( appear only under repositories/ and db/ (rule 4)', () => {
    const files = walk(serverSrc, ['.ts']).filter((f) => {
      const r = rel(f);
      return !isTest(f) && !r.startsWith('packages/server/src/repositories/') && !r.startsWith('packages/server/src/db/');
    });
    expect(collect(files, (_p, t) => rawSqlViolations(t))).toEqual([]);
  });

  it(`no source file is over ${MAX_LINES} lines (rule 5)`, () => {
    const ts = packageSrcDirs().flatMap((d) => walk(d, ['.ts', '.tsx']));
    const kt = androidSrcDirs().flatMap((d) => walk(d, ['.kt']));
    expect(ts.length).toBeGreaterThan(0);
    expect(kt.length).toBeGreaterThan(0);
    expect(collect([...ts, ...kt], (_p, t) => lineCountViolations(t))).toEqual([]);
  });

  it('the only index.ts files under packages/*/src are the two entry points (rule 6)', () => {
    const files = packageSrcDirs().flatMap((d) => walk(d, ['.ts']));
    expect(collect(files, (p) => indexFileViolations(p))).toEqual([]);
    expect(files.map(rel)).toEqual(expect.arrayContaining(ALLOWED_INDEX_FILES));
  });
});

describe('structure rule functions on synthetic input', () => {
  it('fails when a route gains a value import of a repository', () => {
    const text = `import { MovieRepository } from '../repositories/movieRepository.js';\n`;
    expect(routeRepositoryViolations(text, false)).toHaveLength(1);
    expect(routeRepositoryViolations(`import Foo, { type Bar } from '../repositories/x.js';`, false)).toHaveLength(1);
    expect(routeRepositoryViolations(`import {\n  A,\n  B,\n} from '../repositories/x.js';`, false)).toHaveLength(1);
  });

  it('passes type-only imports of a repository', () => {
    expect(routeRepositoryViolations(`import type { MovieRepository } from '../repositories/movieRepository.js';`, false)).toEqual([]);
    expect(routeRepositoryViolations(`import { type A, type B } from '../repositories/x.js';`, false)).toEqual([]);
  });

  it('fails when an allowlisted file is clean, passes when it still needs the entry', () => {
    expect(routeRepositoryViolations(`import type { X } from '../repositories/x.js';`, true)).toHaveLength(1);
    expect(routeRepositoryViolations(`import { X } from '../repositories/x.js';`, true)).toEqual([]);
  });

  it('fails when a route imports from ../db/', () => {
    expect(routeDbViolations(`import { db } from '../db/db.js';`)).toHaveLength(1);
    expect(routeDbViolations(`import { x } from '../services/x.js';`)).toEqual([]);
  });

  it('fails when a service imports fastify', () => {
    expect(serviceFastifyViolations(`import type { FastifyInstance } from 'fastify';`)).toHaveLength(1);
    expect(serviceFastifyViolations(`import { x } from './x.js';`)).toEqual([]);
  });

  it('fails on .prepare( and .pragma( calls', () => {
    expect(rawSqlViolations('db.prepare("select 1")')).toHaveLength(1);
    expect(rawSqlViolations('db.pragma("foreign_keys = ON")')).toHaveLength(1);
    expect(rawSqlViolations('const x = 1;')).toEqual([]);
  });

  it('fails on a 701-line file and passes on 700', () => {
    expect(lineCountViolations('x\n'.repeat(701))).toHaveLength(1);
    expect(lineCountViolations('x\n'.repeat(700))).toEqual([]);
    expect(lineCountViolations('x\n'.repeat(699) + 'x')).toEqual([]);
  });

  it('fails on a stray index.ts', () => {
    expect(indexFileViolations('packages/client/src/components/index.ts')).toHaveLength(1);
    expect(indexFileViolations('packages/server/src/index.ts')).toEqual([]);
    expect(indexFileViolations('packages/client/src/main.tsx')).toEqual([]);
  });
});
