import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { timelineOffsetSeconds } from '../../config/transcode.js';
import { readKeyframes } from '../../providers/keyframes/keyframeRegistry.js';
import { EncoderRegistry } from '../../providers/transcode/encoderRegistry.js';
import { FfmpegLocator } from '../../providers/transcode/ffmpegLocator.js';
import type { PlaybackDecision } from '../playbackDecider.js';
import { planSegments } from './segmentPlan.js';
import type { HlsSessionInput } from './sessionOpener.js';
import { TranscodeSessionService } from './transcodeSessionService.js';

/** Real ffmpeg end to end: a 30 s MKV (H.264 with irregular GOPs and B-frames, 5.1 AC-3) through remux and transcode sessions. */
const hasTool = (name: string) => { try { return spawnSync(name, ['-version'], { windowsHide: true }).status === 0; } catch { return false; } };
const available = hasTool('ffmpeg') && hasTool('ffprobe');
const forcedKeyframes = [0, 1.5, 4, 4.7, 7, 10, 11.2, 13.9, 16, 19.5, 21, 22.3, 25, 28];
const timeout = 180_000;

interface SegmentTimes { video: number; audio: number | null }

/** First video and audio presentation times (ms, film timeline) of `init + segment`, read back with ffprobe. */
function probeSegment(dir: string, init: string, segment: string): SegmentTimes {
  const file = join(dir, `probe-${Math.random().toString(36).slice(2)}.mp4`);
  writeFileSync(file, Buffer.concat([readFileSync(init), readFileSync(segment)]));
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'packet=pts_time,stream_index', '-of', 'json', file], { encoding: 'utf8', windowsHide: true });
  const packets = (JSON.parse(result.stdout).packets ?? []) as { pts_time: string; stream_index: number }[];
  const first = (stream: number) => {
    const times = packets.filter((packet) => packet.stream_index === stream).map((packet) => Number(packet.pts_time) * 1000 - timelineOffsetSeconds * 1000);
    return times.length ? Math.min(...times) : null;
  };
  return { video: first(0)!, audio: first(1) };
}

describe.skipIf(!available)('HLS sessions with the real ffmpeg', () => {
  let dir = ''; let source = ''; let keyframes: number[] = [];
  const logs: string[] = [];
  let service: TranscodeSessionService;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'ottlib-hls-real-'));
    source = join(dir, 'irregular.mkv');
    const made = spawnSync('ffmpeg', [
      '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=24000/1001:d=30', '-f', 'lavfi', '-i', 'sine=f=440:d=30:sample_rate=48000',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '1000', '-sc_threshold', '0', '-bf', '2', '-force_key_frames', forcedKeyframes.join(','),
      '-c:a', 'ac3', '-ac', '6', '-b:a', '384k', source
    ], { windowsHide: true, encoding: 'utf8' });
    if (made.status !== 0) throw new Error(`could not make the test file: ${made.stderr}`);
    const locator = new FfmpegLocator();
    service = new TranscodeSessionService({
      locate: () => locator.locate(), encoders: (binary) => new EncoderRegistry(binary), encoderSetting: () => 'auto', streamQuery: () => '',
      root: join(dir, 'sessions'), log: (message) => { logs.push(message); console.info(message); },
    });
  }, timeout);

  afterAll(async () => {
    await service?.shutdown();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  const decision = (mode: 'remux' | 'transcode'): PlaybackDecision => ({ mode, audioOrder: 1, audioCopy: false, burnSubtitleOrder: null, toneMap: false, reasons: ['container'] });
  const input = (mode: 'remux' | 'transcode', startMs?: number): HlsSessionInput => ({
    movie: { id: 1, path: source, folderPath: dir, filename: 'irregular.mkv', missing: false },
    mediaInfo: { container: 'MKV', durationMs: 30_000, width: 640, height: 360, videoCodec: 'H.264', videoProfile: null, videoBitRate: 2_000_000, hdrFormat: null },
    decision: decision(mode), keyframesMs: mode === 'remux' ? keyframes : [], audioChannels: 6, startMs,
  });
  const idOf = (url: string) => url.split('/')[4];

  it('remux: cuts on the planned keyframes from the start and after restarts, with the same init and timeline', async () => {
    keyframes = (await readKeyframes(source, 'MKV')) ?? [];
    expect(keyframes.length).toBe(forcedKeyframes.length);
    const plan = planSegments({ mode: 'remux', durationMs: 30_000, keyframesMs: keyframes });

    const openedAt = Date.now();
    const first = idOf((await service.open(input('remux'))).playlistUrl);
    const firstInit = await service.init(1, first);
    const original = new Map<number, SegmentTimes>();
    const seg0 = await service.segment(1, first, 0);
    console.info(`numbers: time-to-first-segment remux ${Date.now() - openedAt} ms`);
    original.set(0, probeSegment(dir, firstInit, seg0));
    for (let index = 1; index < plan.segments.length; index += 1) {
      const times = probeSegment(dir, firstInit, await service.segment(1, first, index));
      expect(Math.abs(times.video - plan.segments[index].start), `segment ${index}`).toBeLessThanOrEqual(2);
      original.set(index, times);
    }

    // A session that starts mid-film (restart at segment 5), then a far request behind it (restart at segment 2).
    const restarted = idOf((await service.open(input('remux', 10_500))).playlistUrl);
    const restartInit = await service.init(1, restarted);
    expect(readFileSync(restartInit).equals(readFileSync(firstInit))).toBe(true);
    for (const index of [5, 6, 9, 2, 3]) {
      const times = probeSegment(dir, restartInit, await service.segment(1, restarted, index));
      const before = original.get(index)!;
      expect(Math.abs(times.video - plan.segments[index].start), `restarted segment ${index}`).toBeLessThanOrEqual(2);
      expect(Math.abs(times.video - before.video), `video drift ${index}`).toBeLessThanOrEqual(1);
      // The first audio packet can differ by a frame (32 ms AC-3 source, re-encoded in 21.3 ms AAC frames); a timestamp
      // shift (e.g. the 83 ms B-frame delay) would show up well past that.
      expect(Math.abs(times.audio! - before.audio!), `audio drift ${index}`).toBeLessThanOrEqual(50);
    }
  }, timeout);

  it('transcode: 4 s segments on the film timeline, also after a restart', async () => {
    const openedAt = Date.now();
    const first = idOf((await service.open(input('transcode'))).playlistUrl);
    const init = await service.init(1, first);
    const seg0 = await service.segment(1, first, 0);
    console.info(`numbers: time-to-first-segment transcode ${Date.now() - openedAt} ms`);
    expect(probeSegment(dir, init, seg0).video).toBeLessThanOrEqual(42);
    const original = new Map<number, SegmentTimes>();
    for (const index of [4, 5, 6]) {
      const times = probeSegment(dir, init, await service.segment(1, first, index));
      expect(Math.abs(times.video - index * 4000), `segment ${index}`).toBeLessThanOrEqual(42);
      original.set(index, times);
    }

    const restarted = idOf((await service.open(input('transcode', 16_500))).playlistUrl);
    const restartInit = await service.init(1, restarted);
    for (const index of [4, 5, 6]) {
      const times = probeSegment(dir, restartInit, await service.segment(1, restarted, index));
      const before = original.get(index)!;
      console.info(`transcode segment ${index}: original video ${before.video} audio ${before.audio}; restarted video ${times.video} audio ${times.audio}`);
      // Within a frame of the plan; audio packets are cut wherever the encoder's video delay puts the fragment boundary.
      expect(Math.abs(times.video - index * 4000), `restarted segment ${index}`).toBeLessThanOrEqual(42);
      if (index > 4) expect(Math.abs(times.audio! - before.audio!), `audio drift ${index}`).toBeLessThanOrEqual(50);
    }
    expect(logs.some((line) => /transcode session .* first segment/.test(line))).toBe(true);
  }, timeout);
});
