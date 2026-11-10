// Fetches the pinned ffmpeg build for the full server bundle: a BtbN GPL static build (NVENC, QSV, AMF, libplacebo, zimg),
// checksum-verified, with only the ffmpeg binary kept. macOS has no BtbN build, so it relies on ffmpeg on the PATH.
//   node scripts/bundle-ffmpeg.mjs <dir>   downloads and verifies the build for this platform into <dir>
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, createWriteStream, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

// A dated autobuild, never `latest`. To update: pick a newer tag, take the hashes from its checksums.sha256.
export const FFMPEG_RELEASE = 'autobuild-2026-11-10-12-39';
const FFMPEG_BUILD = 'ffmpeg-n9.0.2-48-gd4070a14ce';
const FFMPEG_ARCHIVES = {
  'win32-x64': { file: `${FFMPEG_BUILD}-win64-gpl-9.0.zip`, sha256: 'e08cfa1d5ec52a4e405c55ddb6c91b42fb2a9dafe5bcecfcbffd6db3e9bdba0e' },
  'linux-x64': { file: `${FFMPEG_BUILD}-linux64-gpl-9.0.tar.xz`, sha256: '8206a48ce342b5075d0e0293e468a61198a55b3ef479bec3f7e83b04a18667d4' },
  'linux-arm64': { file: `${FFMPEG_BUILD}-linuxarm64-gpl-9.0.tar.xz`, sha256: '1da51cfc6e138620bf733937fea574313454f5b8b8de866dacc0e9ef9b6a0645' },
};

export const FFMPEG_NOTICE =
  `ffmpeg (FFmpeg ${FFMPEG_BUILD.slice('ffmpeg-'.length)}) is a separate GPL-3.0 program, bundled unmodified from the BtbN FFmpeg-Builds ` +
  `GPL static build (release ${FFMPEG_RELEASE}). Source: https://ffmpeg.org and https://github.com/BtbN/FFmpeg-Builds\n`;

/** The pinned archive for a platform, or null when that platform ships without ffmpeg (macOS). */
export function ffmpegArchive(platform = process.platform, arch = process.arch) {
  const entry = FFMPEG_ARCHIVES[`${platform}-${arch}`];
  if (!entry) return null;
  return { ...entry, url: `https://github.com/BtbN/FFmpeg-Builds/releases/download/${FFMPEG_RELEASE}/${entry.file}` };
}

async function download(url, target) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  const hash = createHash('sha256');
  const tee = new Transform({ transform(chunk, _encoding, done) { hash.update(chunk); done(null, chunk); } });
  await pipeline(Readable.fromWeb(response.body), tee, createWriteStream(target));
  return hash.digest('hex');
}

/** Downloads, verifies and extracts the ffmpeg binary into `targetDir`. Returns its path, or null on platforms without a pinned build. */
export async function fetchBundledFfmpeg(targetDir) {
  const archive = ffmpegArchive();
  if (!archive) return null;
  const binary = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const scratch = mkdtempSync(join(tmpdir(), 'ffmpeg-'));
  try {
    const archivePath = join(scratch, archive.file);
    const actual = await download(archive.url, archivePath);
    if (actual !== archive.sha256) throw new Error(`Checksum mismatch for ${archive.file}: expected ${archive.sha256}, got ${actual}`);
    // The archive holds <archive name>/bin/ffmpeg(.exe); extract only that member.
    const member = `${archive.file.replace(/\.(zip|tar\.xz)$/, '')}/bin/${binary}`;
    // Windows' own bsdtar reads zips; a GNU tar from Git or MSYS earlier on the PATH would not.
    const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
    execFileSync(tar, ['-xf', archivePath, '-C', scratch, member], { stdio: 'inherit' });
    const extracted = join(scratch, member);
    if (!existsSync(extracted)) throw new Error(`${archive.file} has no ${member}`);
    mkdirSync(targetDir, { recursive: true });
    const target = join(targetDir, binary);
    copyFileSync(extracted, target);
    chmodSync(target, 0o755);
    return target;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: node scripts/bundle-ffmpeg.mjs <dir>');
  const path = await fetchBundledFfmpeg(dir);
  console.log(path ? `Verified ${path}` : `No pinned ffmpeg build for ${process.platform}/${process.arch}`);
}
