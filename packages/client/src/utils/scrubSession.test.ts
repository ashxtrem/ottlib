import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScrubSession, liveSeek, type ScrubSessionOptions } from './scrubSession';

describe('liveSeek', () => {
  it('uses fastSeek when the browser has it', () => {
    const fastSeek = vi.fn();
    const video = { duration: 100, currentTime: 0, fastSeek };
    liveSeek(video, 42);
    expect(fastSeek).toHaveBeenCalledWith(42);
    expect(video.currentTime).toBe(0);
  });

  it('sets currentTime otherwise, inside the film', () => {
    const video = { duration: 100, currentTime: 0 };
    liveSeek(video, 42);
    expect(video.currentTime).toBe(42);
    liveSeek(video, -3);
    expect(video.currentTime).toBe(0);
  });

  it('never lands on the exact end (that would fire ended mid-drag), fastSeek included', () => {
    const video = { duration: 100, currentTime: 0 };
    liveSeek(video, 100);
    expect(video.currentTime).toBe(98);
    liveSeek(video, 500);
    expect(video.currentTime).toBeLessThan(video.duration);
    const fastSeek = vi.fn();
    liveSeek({ duration: 100, currentTime: 0, fastSeek }, 100);
    expect(fastSeek).toHaveBeenCalledWith(98);
    const short = { duration: 1, currentTime: 5 };
    liveSeek(short, 1);
    expect(short.currentTime).toBe(0);
  });

  it('does not clamp to an unknown duration', () => {
    const video = { duration: Number.NaN, currentTime: 0 };
    liveSeek(video, 500);
    expect(video.currentTime).toBe(500);
  });
});

describe('createScrubSession', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function setup(kind: 'direct' | 'hls', frames: (url: string) => Promise<string | null> = async (url) => `blob:${url}`) {
    const seekLive = vi.fn();
    const fetchFrame = vi.fn((url: string, _signal?: AbortSignal) => frames(url));
    const releaseFrame = vi.fn();
    const onFrame = vi.fn();
    const options: ScrubSessionOptions = { kind, durationMs: 600_000, framePreviewUrl: '/api/movies/1/frame?key=k', seekLive, fetchFrame, releaseFrame, onFrame };
    return { session: createScrubSession(options), seekLive, fetchFrame, releaseFrame, onFrame };
  }

  it('direct play seeks live at most once per 150 ms and never asks for frames', () => {
    const { session, seekLive, fetchFrame } = setup('direct');
    for (let step = 0; step <= 30; step += 1) { session.scrub(step * 1000); vi.advanceTimersByTime(10); }
    vi.advanceTimersByTime(150);
    expect(fetchFrame).not.toHaveBeenCalled();
    // 300 ms of dragging: the leading seek plus one per 150 ms interval at most.
    expect(seekLive.mock.calls.length).toBeLessThanOrEqual(4);
    expect(seekLive.mock.calls[0]).toEqual([0]);
    expect(seekLive.mock.calls.at(-1)).toEqual([30]);
  });

  it('end drops the trailing live seek', () => {
    const { session, seekLive } = setup('direct');
    session.scrub(1000);
    session.scrub(2000);
    session.end();
    vi.advanceTimersByTime(1000);
    expect(seekLive.mock.calls).toEqual([[1]]);
  });

  it('hls never seeks the stream; it asks for frames at the 2 s step, throttled', async () => {
    const { session, seekLive, fetchFrame } = setup('hls');
    session.scrub(41_300);
    session.scrub(50_000);
    session.scrub(61_000);
    expect(fetchFrame.mock.calls.map((call) => call[0])).toEqual(['/api/movies/1/frame?key=k&t=42000']);
    await vi.advanceTimersByTimeAsync(150);
    expect(fetchFrame.mock.calls.map((call) => call[0])).toEqual(['/api/movies/1/frame?key=k&t=42000', '/api/movies/1/frame?key=k&t=62000']);
    expect(seekLive).not.toHaveBeenCalled();
  });

  it('skips a request for the frame time it already asked for', async () => {
    const { session, fetchFrame } = setup('hls');
    session.scrub(41_300);
    await vi.advanceTimersByTimeAsync(150);
    session.scrub(41_900);
    await vi.advanceTimersByTimeAsync(150);
    expect(fetchFrame).toHaveBeenCalledTimes(1);
  });

  it('keeps the last frame when a newer request answers 204', async () => {
    const answers = new Map<string, string | null>([['/api/movies/1/frame?key=k&t=10000', 'blob:ten'], ['/api/movies/1/frame?key=k&t=20000', null]]);
    const { session, onFrame, releaseFrame } = setup('hls', async (url) => answers.get(url) ?? null);
    session.scrub(10_000);
    await vi.advanceTimersByTimeAsync(0);
    session.scrub(20_000);
    await vi.advanceTimersByTimeAsync(150);
    expect(onFrame.mock.calls).toEqual([['blob:ten']]);
    expect(releaseFrame).not.toHaveBeenCalled();
  });

  it('shows a frame only if it is newer than the one on screen, and frees the old frame', async () => {
    const pending = new Map<string, (src: string | null) => void>();
    const { session, onFrame, releaseFrame } = setup('hls', (url) => new Promise((resolve) => { pending.set(url, resolve); }));
    session.scrub(10_000);
    await vi.advanceTimersByTimeAsync(150);
    session.scrub(20_000);
    await vi.advanceTimersByTimeAsync(150);
    // The newer answer lands first; the older one is dropped and freed.
    pending.get('/api/movies/1/frame?key=k&t=20000')?.('blob:twenty');
    await vi.advanceTimersByTimeAsync(0);
    pending.get('/api/movies/1/frame?key=k&t=10000')?.('blob:ten');
    await vi.advanceTimersByTimeAsync(0);
    expect(onFrame.mock.calls).toEqual([['blob:twenty']]);
    expect(releaseFrame.mock.calls).toEqual([['blob:ten']]);
  });

  it('end clears the frame, frees it and aborts what is in flight', async () => {
    const signals: AbortSignal[] = [];
    const { session, onFrame, releaseFrame, fetchFrame } = setup('hls');
    fetchFrame.mockImplementation(async (url: string, signal?: AbortSignal) => { if (signal) signals.push(signal); return `blob:${url}`; });
    session.scrub(10_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(onFrame).toHaveBeenLastCalledWith('blob:/api/movies/1/frame?key=k&t=10000');
    session.end();
    expect(signals[0]?.aborted).toBe(true);
    expect(onFrame).toHaveBeenLastCalledWith(null);
    expect(releaseFrame).toHaveBeenCalledWith('blob:/api/movies/1/frame?key=k&t=10000');
    // The next drag starts clean, with its own signal.
    session.scrub(10_000);
    await vi.advanceTimersByTimeAsync(150);
    expect(signals[1]?.aborted).toBe(false);
  });
});
