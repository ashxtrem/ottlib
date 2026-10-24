import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EncoderRegistry } from '../../providers/transcode/encoderRegistry.js';
import type { FfmpegBinary } from '../../providers/transcode/ffmpegLocator.js';
import { nvencEncoder } from '../../providers/transcode/nvencEncoder.js';
import { x264Encoder } from '../../providers/transcode/x264Encoder.js';
import type { PlaybackDecision } from '../playbackDecider.js';
import { fakeSpawner, fragment } from './fmp4Fixture.js';
import { SessionBusyError, type HlsSessionInput } from './sessionOpener.js';
import { defaultTranscodeRoot, SessionNotFoundError, TranscodeSessionService } from './transcodeSessionService.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

const binary: FfmpegBinary = { path: 'ffmpeg', version: 'ffmpeg version test', encoders: new Set(['libx264']), filters: new Set(), run: async () => ({ code: 0, stdout: '', stderr: '' }) };
const keyframes = Array.from({ length: 300 }, (_unused, index) => index * 2000);

function decision(mode: 'remux' | 'transcode'): PlaybackDecision {
  return { mode, audioOrder: 1, audioCopy: false, burnSubtitleOrder: null, toneMap: false, reasons: ['container'] };
}

function input(mode: 'remux' | 'transcode' = 'remux', extra: Partial<HlsSessionInput> = {}): HlsSessionInput {
  return {
    movie: { id: 7, path: '/films/Arrival.mkv', folderPath: '/films', filename: 'Arrival.mkv', missing: false },
    mediaInfo: { container: 'MKV', durationMs: 600_000, width: 1920, height: 1080, videoCodec: 'H.264', videoProfile: null, videoBitRate: 8_000_000, hdrFormat: null },
    decision: decision(mode), keyframesMs: mode === 'remux' ? keyframes : [], audioChannels: 6, ...extra,
  };
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ottlib-hls-sessions-')); directories.push(root);
  const fake = fakeSpawner(); const clock = { now: 1_000 }; const logs: string[] = [];
  const service = new TranscodeSessionService({
    locate: async () => binary, encoders: (ffmpeg) => new EncoderRegistry(ffmpeg, [{ ...x264Encoder, probe: async () => true }]),
    encoderSetting: () => 'auto', streamQuery: () => '?key=abc', spawn: fake.spawn, root, now: () => clock.now, log: (message) => logs.push(message),
  });
  return { service, root, runs: fake.runs, clock, logs };
}

const sessionId = (url: string) => url.split('/')[4];

describe('TranscodeSessionService', () => {
  it('opens a session at the segment holding startMs, with a key-carrying playlist covering the whole film', async () => {
    const { service, runs } = fixture();
    const handle = await service.open(input('remux', { startMs: 61_000 }));
    expect(handle.playlistUrl).toMatch(/^\/api\/hls\/7\/[0-9a-f]{16}\/main\.m3u8\?key=abc$/);
    expect(handle.sessionUrl).toBe(handle.playlistUrl.replace('/main.m3u8?key=abc', ''));
    expect(runs).toHaveLength(1);
    expect(runs[0].args[runs[0].args.indexOf('-ss') + 1]).toBe('60.200');
    const playlist = service.playlist(7, sessionId(handle.playlistUrl));
    expect(playlist).toContain('#EXT-X-MAP:URI="init.mp4?key=abc"');
    expect(playlist).toContain('seg-299.m4s?key=abc');
    expect(() => service.playlist(8, sessionId(handle.playlistUrl))).toThrow(SessionNotFoundError);
    await service.shutdown();
  });

  it('serves the init segment and makes a near request wait for the running ffmpeg', async () => {
    const { service, runs, logs } = fixture();
    const id = sessionId((await service.open(input())).playlistUrl);
    const init = service.init(7, id); const first = service.segment(7, id, 0);
    runs[0].produce([0, 2000]); // segment 0 is complete once segment 1 opens
    expect(readFileSync(await first).equals(fragment(0))).toBe(true);
    expect(existsSync(await init)).toBe(true);
    const near = service.segment(7, id, 4); // newest is 0; up to 4 past it waits
    runs[0].produce([4000, 6000, 8000, 10_000], false);
    expect(existsSync(await near)).toBe(true);
    expect(runs).toHaveLength(1);
    expect(logs.some((line) => /remux session .*first segment \(0\) after \d+ ms/.test(line))).toBe(true);
    await service.shutdown();
  });

  it('restarts ffmpeg at a far segment', async () => {
    const { service, runs } = fixture();
    const id = sessionId((await service.open(input())).playlistUrl);
    runs[0].produce([0, 2000]);
    await service.segment(7, id, 0);
    const far = service.segment(7, id, 100);
    expect(runs).toHaveLength(2);
    expect(runs[0].killed).toBe(true);
    expect(runs[1].args[runs[1].args.indexOf('-ss') + 1]).toBe('200.200');
    runs[1].produce([200_000, 202_000]);
    expect(readFileSync(await far).equals(fragment(200_000))).toBe(true);
    await service.shutdown();
  });

  it('restarts ffmpeg on a backward seek to a segment already deleted behind the player', async () => {
    const { service, runs, root } = fixture();
    const id = sessionId((await service.open(input())).playlistUrl);
    const first = service.segment(7, id, 0);
    runs[0].produce(keyframes.slice(0, 41));
    await first;
    await vi.waitFor(() => expect(existsSync(join(root, id, 'seg-39.m4s'))).toBe(true), { timeout: 5_000, interval: 10 });
    await service.segment(7, id, 38); // deletes segments more than 30 behind it
    await vi.waitFor(() => expect(existsSync(join(root, id, 'seg-5.m4s'))).toBe(false), { timeout: 5_000, interval: 10 });
    const back = service.segment(7, id, 5);
    expect(runs).toHaveLength(2);
    expect(runs[1].args[runs[1].args.indexOf('-ss') + 1]).toBe('10.200');
    runs[1].produce([10_000, 12_000]);
    expect(readFileSync(await back).equals(fragment(10_000))).toBe(true);
    await service.shutdown();
  });

  it('keeps ffmpeg running after the first segment of a session opened deep in the film', async () => {
    const { service, runs, root } = fixture();
    const id = sessionId((await service.open(input('remux', { startMs: 400_000 }))).playlistUrl);
    runs[0].produce([400_000, 402_000, 404_000]); // before the player asks for anything
    await vi.waitFor(() => expect(existsSync(join(root, id, 'seg-201.m4s'))).toBe(true), { timeout: 5_000, interval: 10 });
    expect(runs[0].killed).toBe(false);
    expect(runs).toHaveLength(1);
    await service.shutdown();
  });

  it('serves a segment made of several fragments only once it is complete, and the last one when ffmpeg ends', async () => {
    const { service, runs } = fixture();
    const id = sessionId((await service.open(input('remux', { keyframesMs: [0, 2000], mediaInfo: { ...input().mediaInfo, durationMs: 4_000 } }))).playlistUrl);
    let served = false;
    const first = service.segment(7, id, 0).then((path) => { served = true; return path; });
    const last = service.segment(7, id, 1);
    runs[0].produce([0, 1000]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(served).toBe(false);
    runs[0].produce([2000, 3000], false);
    expect(readFileSync(await first).equals(Buffer.concat([fragment(0), fragment(1000)]))).toBe(true);
    runs[0].exit(0);
    expect(readFileSync(await last).equals(Buffer.concat([fragment(2000), fragment(3000)]))).toBe(true);
    await service.shutdown();
  });

  it('kills an idle session and removes its folder', async () => {
    const { service, runs, clock, root } = fixture();
    const id = sessionId((await service.open(input())).playlistUrl);
    expect(existsSync(join(root, id))).toBe(true);
    clock.now += 44_000; await service.sweep();
    expect(service.sessionCount()).toBe(1);
    clock.now += 2_000; await service.sweep();
    expect(service.sessionCount()).toBe(0);
    expect(runs[0].killed).toBe(true);
    expect(existsSync(join(root, id))).toBe(false);
    await expect(service.segment(7, id, 0)).rejects.toThrow(SessionNotFoundError);
  });

  it('ends a device\'s previous session when it opens a new one', async () => {
    const { service, root } = fixture();
    const device = '3f1c2a52-8a3b-4f0e-9a51-2d6f0f5d9c11';
    const first = sessionId((await service.open(input('remux', { deviceId: device }))).playlistUrl);
    const second = sessionId((await service.open(input('transcode', { deviceId: device }))).playlistUrl);
    expect(service.sessionCount()).toBe(1);
    expect(existsSync(join(root, first))).toBe(false);
    expect(service.playlist(7, second)).toContain('#EXTINF:4.000,');
    await service.shutdown();
  });

  it('refuses a session past the limits with SessionBusyError', async () => {
    const { service } = fixture();
    for (let index = 0; index < 6; index += 1) await service.open(input('remux'));
    await expect(service.open(input('remux'))).rejects.toBeInstanceOf(SessionBusyError);
    for (let index = 0; index < 3; index += 1) await service.open(input('transcode'));
    await expect(service.open(input('transcode'))).rejects.toBeInstanceOf(SessionBusyError);
    await service.shutdown();
  });

  it('lets only one of two overlapping opens take the last free slot', async () => {
    const { service } = fixture();
    for (let index = 0; index < 5; index += 1) await service.open(input('remux'));
    const results = await Promise.allSettled([service.open(input('remux')), service.open(input('remux'))]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: expect.any(SessionBusyError) });
    expect(service.sessionCount()).toBe(6);
    await service.shutdown();
  });

  it('stops ffmpeg 150 segments ahead of the player and restarts it once the player is within 30', async () => {
    const { service, runs } = fixture();
    const id = sessionId((await service.open(input())).playlistUrl);
    const first = service.segment(7, id, 0);
    runs[0].produce(keyframes.slice(0, 160));
    await first;
    await vi.waitFor(() => expect(runs[0].killed).toBe(true), { timeout: 10_000, interval: 20 });
    await service.segment(7, id, 100); // produced; still 50 behind the stop point (150)
    expect(runs).toHaveLength(1);
    await service.segment(7, id, 121);
    expect(runs).toHaveLength(2);
    expect(runs[1].args[runs[1].args.indexOf('-ss') + 1]).toBe('302.200');
    await service.shutdown();
  });

  it('decodes on the CPU when the encoder\'s GPU path fails on the file, and uses the GPU path when it works', async () => {
    for (const [code, hardware] of [[1, false], [0, true]] as const) {
      const fake = fakeSpawner();
      const service = new TranscodeSessionService({
        locate: async () => ({ ...binary, path: `ffmpeg-${code}`, encoders: new Set(['h264_nvenc']), filters: new Set(['scale_cuda']), run: async () => ({ code, stdout: '', stderr: '' }) }),
        encoders: (ffmpeg) => new EncoderRegistry(ffmpeg, [{ ...nvencEncoder, probe: async () => true }]), encoderSetting: () => 'nvenc', streamQuery: () => '',
        spawn: fake.spawn, root: mkdtempSync(join(tmpdir(), 'ottlib-hls-gpu-')), log: () => undefined,
      });
      directories.push(service.root);
      await service.open(input('transcode'));
      expect(fake.runs[0].args.includes('-hwaccel'), `exit code ${code}`).toBe(hardware);
      await service.shutdown();
    }
  });

  it('rejects a waiting request with the stderr tail when ffmpeg fails', async () => {
    const { service, runs } = fixture();
    const id = sessionId((await service.open(input('transcode'))).playlistUrl);
    const waiting = service.segment(7, id, 0);
    runs[0].exit(1, 'Invalid data found when processing input\n');
    await expect(waiting).rejects.toThrow(/exited with code 1: Invalid data found/);
    await service.shutdown();
  });

  it('does not respawn ffmpeg where a run failed until a far request or the retry delay passes', async () => {
    const { service, runs, clock } = fixture();
    const id = sessionId((await service.open(input())).playlistUrl);
    const first = service.segment(7, id, 0);
    runs[0].produce([0, 2000, 4000, 6000]); // segments 0-2 complete
    await first;
    const pending = service.segment(7, id, 3);
    runs[0].exit(1, 'Broken frame\n');
    await expect(pending).rejects.toThrow(/Broken frame/);
    await service.segment(7, id, 1); // produced: served, without resuming at the failed point
    await service.segment(7, id, 2);
    await expect(service.segment(7, id, 3)).rejects.toThrow(/Broken frame/);
    await expect(service.init(7, id)).resolves.toContain('init.mp4');
    expect(runs).toHaveLength(1);
    clock.now += 30_000;
    await service.segment(7, id, 2); // the retry delay passed: resumes after the newest segment
    expect(runs).toHaveLength(2);
    expect(runs[1].args[runs[1].args.indexOf('-ss') + 1]).toBe('6.200');
    await service.shutdown();
  });

  it('starts a new run for a far request after a failure', async () => {
    const { service, runs } = fixture();
    const id = sessionId((await service.open(input())).playlistUrl);
    const pending = service.segment(7, id, 0);
    runs[0].exit(1, 'Broken frame\n');
    await expect(pending).rejects.toThrow(/Broken frame/);
    await expect(service.segment(7, id, 2)).rejects.toThrow(/Broken frame/);
    expect(runs).toHaveLength(1);
    const far = service.segment(7, id, 100);
    expect(runs).toHaveLength(2);
    runs[1].produce([200_000, 202_000]);
    expect(readFileSync(await far).equals(fragment(200_000))).toBe(true);
    await service.shutdown();
  });

  it('keeps its temp root in an ottlib-hls folder of its own under OTTLIB_TRANSCODE_DIR', () => {
    expect(defaultTranscodeRoot({ OTTLIB_TRANSCODE_DIR: join('D:', 'shared') })).toBe(join('D:', 'shared', 'ottlib-hls'));
    expect(defaultTranscodeRoot({})).toBe(join(tmpdir(), 'ottlib-hls'));
  });

  it('empties the temp root at start and removes it on shutdown', async () => {
    const { service, root } = fixture();
    mkdirSync(join(root, 'stale-session'), { recursive: true }); writeFileSync(join(root, 'stale-session', 'seg-1.m4s'), 'old');
    await service.start();
    expect(existsSync(join(root, 'stale-session'))).toBe(false);
    await service.open(input());
    await service.shutdown();
    expect(existsSync(root)).toBe(false);
  });
});
