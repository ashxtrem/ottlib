import { afterEach, describe, expect, it, vi } from 'vitest';
import { framePreviewConfig } from '../../config/framePreview.js';
import type { FfmpegBinary } from '../../providers/transcode/ffmpegLocator.js';
import { MovieUnavailableError } from '../playbackService.js';
import { fakeFrameSpawner, fakeJpeg } from './frameFixture.js';
import { FrameError, FrameService, frameArgs } from './frameService.js';

const binary = { path: 'ffmpeg-test' } as FfmpegBinary;
const durations: Record<number, number | null> = { 1: 60_000, 2: 60_000, 3: 60_000, 4: null };

function fixture(options: { auto?: boolean; ffmpeg?: FfmpegBinary | null } = {}) {
  const { spawn, runs } = fakeFrameSpawner(options.auto);
  const playback = { movieFile: async (id: number) => {
    if (id === 99) throw new MovieUnavailableError();
    return { id, path: `/films/${id}.mkv`, folderPath: '/films', filename: `${id}.mkv`, missing: false };
  } };
  const movies = { get: (id: number) => (id in durations ? { mediaInfo: { durationMs: durations[id] } } : undefined) } as never;
  const locate = async () => (options.ffmpeg === undefined ? binary : options.ffmpeg);
  return { service: new FrameService(playback, movies, locate, spawn), runs };
}
const started = (runs: unknown[], count: number) => vi.waitFor(() => expect(runs).toHaveLength(count));
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const seek = (run: { args: string[] }) => run.args[run.args.indexOf('-ss') + 1];

describe('FrameService', () => {
  afterEach(() => { framePreviewConfig.cacheSize = 300; });

  it('grabs the keyframe at the rounded time as a small JPEG on stdout', async () => {
    const { service, runs } = fixture();
    const pending = service.frame(1, 12_345, 'a');
    await started(runs, 1);
    expect(runs[0].command).toBe('ffmpeg-test');
    expect(runs[0].args).toEqual(frameArgs('/films/1.mkv', 12_000));
    expect(runs[0].args.join(' ')).toContain('-skip_frame nokey -ss 12.000 -i /films/1.mkv -frames:v 1 -vf scale=320:-2 -q:v 5');
    expect(runs[0].args.slice(-5)).toEqual(['-f', 'image2', '-c:v', 'mjpeg', 'pipe:1']);
    runs[0].finish();
    expect((await pending)?.equals(fakeJpeg)).toBe(true);
  });

  it('runs at most two ffmpeg at once and starts the queued ones as slots free up', async () => {
    const { service, runs } = fixture();
    const results = [1, 2, 3, 4].map((client) => service.frame(1, client * 10_000, `client-${client}`));
    await started(runs, 2);
    await settle();
    expect(runs).toHaveLength(2);
    runs[0].finish();
    await started(runs, 3);
    expect(runs).toHaveLength(3);
    runs[1].finish(); runs[2].finish();
    await started(runs, 4);
    runs[3].finish();
    expect((await Promise.all(results)).every((jpeg) => jpeg?.equals(fakeJpeg))).toBe(true);
  });

  it('cancels the older request of the same client and movie: kills its ffmpeg and answers null', async () => {
    const { service, runs } = fixture();
    const older = service.frame(1, 10_000, 'a');
    await started(runs, 1);
    const newer = service.frame(1, 20_000, 'a');
    expect(await older).toBeNull();
    expect(runs[0].killed).toBe(true);
    await started(runs, 2);
    expect(seek(runs[1])).toBe('20.000');
    runs[1].finish();
    expect((await newer)?.equals(fakeJpeg)).toBe(true);
  });

  it('drops a queued older request without ever starting ffmpeg for it', async () => {
    const { service, runs } = fixture();
    const busy = [service.frame(1, 0, 'x'), service.frame(1, 0, 'y')];
    await started(runs, 2);
    const older = service.frame(2, 10_000, 'a');
    await settle();
    const newer = service.frame(2, 30_000, 'a');
    expect(await older).toBeNull();
    runs[0].finish();
    await started(runs, 3);
    expect(seek(runs[2])).toBe('30.000');
    expect(runs.filter((run) => seek(run) === '10.000')).toHaveLength(0);
    runs[1].finish(); runs[2].finish();
    await Promise.all([...busy, newer]);
  });

  it('keeps requests of other clients or other movies running', async () => {
    const { service, runs } = fixture();
    const first = service.frame(1, 10_000, 'a');
    const otherClient = service.frame(1, 20_000, 'b');
    await started(runs, 2);
    expect(runs.some((run) => run.killed)).toBe(false);
    runs[0].finish(); runs[1].finish();
    await Promise.all([first, otherClient]);
    const movieOne = service.frame(1, 30_000, 'a');
    const movieTwo = service.frame(2, 30_000, 'a');
    await started(runs, 4);
    expect(runs.slice(2).some((run) => run.killed)).toBe(false);
    runs[2].finish(); runs[3].finish();
    await Promise.all([movieOne, movieTwo]);
  });

  it('kills ffmpeg when the request is closed', async () => {
    const { service, runs } = fixture();
    const controller = new AbortController();
    const pending = service.frame(1, 10_000, 'a', controller.signal);
    await started(runs, 1);
    controller.abort();
    expect(await pending).toBeNull();
    expect(runs[0].killed).toBe(true);
  });

  it('starts nothing for a request that was already closed', async () => {
    const { service, runs } = fixture();
    const controller = new AbortController(); controller.abort();
    expect(await service.frame(1, 10_000, 'a', controller.signal)).toBeNull();
    await settle();
    expect(runs).toHaveLength(0);
  });

  it('frees the slot of a killed ffmpeg for the next request', async () => {
    const { service, runs } = fixture();
    const controllers = [new AbortController(), new AbortController()];
    const aborted = [service.frame(1, 0, 'x', controllers[0].signal), service.frame(2, 0, 'y', controllers[1].signal)];
    const waiting = service.frame(3, 0, 'z');
    await started(runs, 2);
    controllers.forEach((controller) => controller.abort());
    await Promise.all(aborted);
    await started(runs, 3);
    runs[2].finish();
    expect((await waiting)?.equals(fakeJpeg)).toBe(true);
  });

  it('serves a cached frame without running ffmpeg, keyed by movie and time rounded to 2 s', async () => {
    const { service, runs } = fixture({ auto: true });
    const first = await service.frame(1, 1_000, 'a');
    expect(runs).toHaveLength(1);
    expect(seek(runs[0])).toBe('2.000');
    expect((await service.frame(1, 2_900, 'a'))?.equals(first!)).toBe(true);
    await service.frame(1, 3_100, 'b');
    expect(runs).toHaveLength(2);
    await service.frame(2, 1_000, 'a');
    expect(runs).toHaveLength(3);
    await service.frame(1, 1_000, 'c');
    expect(runs).toHaveLength(3);
  });

  it('keeps the 300 most recently used frames', async () => {
    framePreviewConfig.cacheSize = 2;
    const { service, runs } = fixture({ auto: true });
    await service.frame(1, 0, 'a'); await service.frame(1, 2_000, 'a');
    await service.frame(1, 0, 'a');
    await service.frame(1, 4_000, 'a');
    expect(runs).toHaveLength(3);
    await service.frame(1, 0, 'a');
    expect(runs).toHaveLength(3);
    await service.frame(1, 2_000, 'a');
    expect(runs).toHaveLength(4);
  });

  it('clamps the time into [0, duration]', async () => {
    const { service, runs } = fixture({ auto: true });
    await service.frame(1, 9_999_999, 'a');
    await service.frame(2, -5_000, 'a');
    await service.frame(4, 7_000_000, 'a');
    expect(runs.map(seek)).toEqual(['60.000', '0.000', '7000.000']);
  });

  it('rejects with MovieUnavailableError for an unknown movie', async () => {
    const { service } = fixture();
    await expect(service.frame(99, 0, 'a')).rejects.toBeInstanceOf(MovieUnavailableError);
  });

  it('fails with 503 without ffmpeg, 502 when ffmpeg fails and 404 when it makes no frame', async () => {
    const missing = fixture({ ffmpeg: null });
    await expect(missing.service.frame(1, 0, 'a')).rejects.toMatchObject({ status: 503 });
    expect(missing.runs).toHaveLength(0);

    const failing = fixture();
    const failed = failing.service.frame(1, 0, 'a');
    await started(failing.runs, 1);
    failing.runs[0].finish(Buffer.alloc(0), 1);
    await expect(failed).rejects.toBeInstanceOf(FrameError);

    // Nothing after the last keyframe: ffmpeg is run once more without -skip_frame; still nothing is a 404.
    const empty = fixture();
    const none = empty.service.frame(1, 0, 'a');
    await started(empty.runs, 1);
    expect(empty.runs[0].args).toContain('-skip_frame');
    empty.runs[0].finish(Buffer.alloc(0), 0);
    await started(empty.runs, 2);
    expect(empty.runs[1].args).not.toContain('-skip_frame');
    empty.runs[1].finish(Buffer.alloc(0), 0);
    await expect(none).rejects.toMatchObject({ status: 404 });
    // A failed grab frees its slot and is not cached.
    const retry = empty.service.frame(1, 0, 'a');
    await started(empty.runs, 3);
    empty.runs[2].finish();
    expect((await retry)?.equals(fakeJpeg)).toBe(true);
  });

  it('falls back to decoding up to the time when there is no keyframe after it', async () => {
    const { service, runs } = fixture();
    const pending = service.frame(1, 58_000, 'a');
    await started(runs, 1);
    runs[0].finish(Buffer.alloc(0), 0);
    await started(runs, 2);
    runs[1].finish();
    expect((await pending)?.equals(fakeJpeg)).toBe(true);
    expect(runs.map((run) => run.args.includes('-skip_frame'))).toEqual([true, false]);
  });
});
