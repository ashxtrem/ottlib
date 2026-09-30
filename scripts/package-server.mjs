// Stages a self-contained OttLib server folder and archives it. Run after `npm run build`.
//   node scripts/package-server.mjs --version 0.2.0 --variant full|lite --out release
// "full" adds a Node runtime and ffprobe; "lite" expects both to be installed on the host.
// Native modules (better-sqlite3) are installed for the platform this runs on, so run it once per OS/arch.
import { execFileSync, execSync } from 'node:child_process';
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []));
const version = args.version ?? '0.0.0-dev';
const variant = args.variant ?? 'full';
const outDir = args.out ?? 'release';
if (!['full', 'lite'].includes(variant)) throw new Error(`--variant must be full or lite, got ${variant}`);

const isWindows = process.platform === 'win32';
const os = { win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform];
const name = `ottlib-${version}-${os}-${process.arch}${variant === 'lite' ? '-lite' : ''}`;
const stage = join(outDir, name);
const run = (cmd, cmdArgs, cwd) => (cmd === 'npm' ? execSync(['npm', ...cmdArgs].join(' '), { cwd, stdio: 'inherit' }) : execFileSync(cmd, cmdArgs, { cwd, stdio: 'inherit' }));

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

for (const file of ['package.json', 'package-lock.json', 'README.md']) copyFileSync(file, join(stage, file));
for (const file of ['LICENSE']) if (existsSync(file)) copyFileSync(file, join(stage, file));
mkdirSync(join(stage, 'config'));
copyFileSync('config/config.example.json', join(stage, 'config', 'config.example.json'));
for (const pkg of ['shared', 'server', 'client']) mkdirSync(join(stage, 'packages', pkg), { recursive: true });
for (const pkg of ['shared', 'server', 'client']) copyFileSync(`packages/${pkg}/package.json`, join(stage, 'packages', pkg, 'package.json'));
for (const dist of ['shared', 'server', 'client']) cpSync(`packages/${dist}/dist`, join(stage, 'packages', dist, 'dist'), { recursive: true });
for (const launcher of ['start.bat', 'start.sh', 'start.command']) {
  copyFileSync(join('scripts', 'bundle', launcher), join(stage, launcher));
  chmodSync(join(stage, launcher), 0o755);
}
writeFileSync(join(stage, 'VERSION'), `${version}\n`);

// Runtime dependencies for the server only (the client is already built).
run('npm', ['ci', '--omit=dev', '--workspace', '@ottlib/server', '--no-audit', '--no-fund'], stage);

// npm links workspaces with absolute symlinks, which break once the folder moves: ship a real copy of shared.
const scoped = join(stage, 'node_modules', '@ottlib');
rmSync(scoped, { recursive: true, force: true });
mkdirSync(join(scoped, 'shared'), { recursive: true });
copyFileSync('packages/shared/package.json', join(scoped, 'shared', 'package.json'));
cpSync('packages/shared/dist', join(scoped, 'shared', 'dist'), { recursive: true });

// better-sqlite3 leaves its SQLite sources and compiler output behind; only the .node binary is needed.
const sqlite = join(stage, 'node_modules', 'better-sqlite3');
for (const extra of ['deps', 'src']) rmSync(join(sqlite, extra), { recursive: true, force: true });
for (const entry of readdirSync(join(sqlite, 'build'))) if (entry !== 'Release') rmSync(join(sqlite, 'build', entry), { recursive: true, force: true });
for (const entry of readdirSync(join(sqlite, 'build', 'Release'))) if (entry !== 'better_sqlite3.node') rmSync(join(sqlite, 'build', 'Release', entry), { recursive: true, force: true });

if (variant === 'full') {
  mkdirSync(join(stage, 'runtime'));
  const nodeTarget = join(stage, 'runtime', isWindows ? 'node.exe' : 'node');
  copyFileSync(process.execPath, nodeTarget);
  chmodSync(nodeTarget, 0o755);

  const scratch = mkdtempSync(join(tmpdir(), 'ffprobe-'));
  writeFileSync(join(scratch, 'package.json'), '{"private":true}');
  run('npm', ['install', '@ffprobe-installer/ffprobe@2.1.2', '--no-audit', '--no-fund'], scratch);
  const ffprobeName = isWindows ? 'ffprobe.exe' : 'ffprobe';
  const source = join(scratch, 'node_modules', '@ffprobe-installer', `${process.platform}-${process.arch}`, ffprobeName);
  if (!existsSync(source)) throw new Error(`@ffprobe-installer has no binary for ${process.platform}/${process.arch}`);
  copyFileSync(source, join(stage, 'runtime', ffprobeName));
  chmodSync(join(stage, 'runtime', ffprobeName), 0o755);
  writeFileSync(join(stage, 'runtime', 'NOTICE.txt'), 'ffprobe (FFmpeg) is a separate GPL-3.0 program, bundled unmodified via @ffprobe-installer. Source: https://ffmpeg.org\n');
  rmSync(scratch, { recursive: true, force: true });
}

const archive = isWindows ? `${name}.zip` : `${name}.tar.gz`;
rmSync(join(outDir, archive), { force: true });
run('tar', isWindows ? ['-a', '-cf', archive, name] : ['-czf', archive, name], outDir);
console.log(`\nCreated ${join(outDir, archive)}`);
