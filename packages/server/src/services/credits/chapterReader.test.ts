import { describe, expect, it } from 'vitest';
import { parseChapters, pickCreditsStartMs, type ChapterSpan } from './chapterReader.js';

const MIN = 60_000;
const DURATION = 100 * MIN;
const chapter = (title: string, startMin: number, endMin: number): ChapterSpan => ({ title, startMs: startMin * MIN, endMs: endMin * MIN });

describe('pickCreditsStartMs', () => {
  it.each(['Credits', 'End Credits', 'end credits', 'EndCredits', 'Closing Credits', 'Outro', 'Ending', 'Ending Credits'])('matches the title "%s"', (title) => {
    expect(pickCreditsStartMs([chapter('Part 1', 0, 90), chapter(title, 90, 100)], DURATION)).toBe(90 * MIN);
  });

  it.each(['Chapter 1', 'Chapter 12', 'Scene 9', '', 'Credibility', 'Intro', 'Opening Titles'])('rejects the generic title "%s"', (title) => {
    expect(pickCreditsStartMs([chapter('Part 1', 0, 90), chapter(title, 90, 100)], DURATION)).toBeNull();
  });

  it('returns null for a file with no chapters or an unknown duration', () => {
    expect(pickCreditsStartMs([], DURATION)).toBeNull();
    expect(pickCreditsStartMs([chapter('Credits', 90, 100)], 0)).toBeNull();
  });

  it('rejects a credit-like chapter that starts before the last 40% of the file', () => {
    expect(pickCreditsStartMs([chapter('Credits', 59, 100)], DURATION)).toBeNull();
    expect(pickCreditsStartMs([chapter('Credits', 60, 100)], DURATION)).toBe(60 * MIN);
  });

  it('accepts a chapter that ends within 30 seconds of the file end, not one that ends further out', () => {
    const near = { title: 'Credits', startMs: 90 * MIN, endMs: DURATION - 30_000 };
    const far = { title: 'Credits', startMs: 90 * MIN, endMs: DURATION - 30_001 };
    expect(pickCreditsStartMs([near], DURATION)).toBe(90 * MIN);
    expect(pickCreditsStartMs([far, chapter('Epilogue', 99, 100)], DURATION)).toBeNull();
  });

  it('accepts a chapter followed only by more credit-like chapters', () => {
    expect(pickCreditsStartMs([chapter('Credits', 80, 90), chapter('Post-Credits Scene', 90, 100)], DURATION)).toBe(80 * MIN);
    expect(pickCreditsStartMs([chapter('Credits', 80, 90), chapter('Outro', 90, 95), chapter('Epilogue', 95, 100)], DURATION)).toBeNull();
  });

  it('picks the first of several credit-like chapters', () => {
    expect(pickCreditsStartMs([chapter('Credits', 85, 90), chapter('End Credits', 90, 100)], DURATION)).toBe(85 * MIN);
  });
});

describe('parseChapters', () => {
  it('reads titles and times from ffprobe JSON, sorted by start', () => {
    const json = JSON.stringify({ chapters: [
      { start_time: '5400.000000', end_time: '6000.000000', tags: { title: 'End Credits' } },
      { start_time: '0.000000', end_time: '5400.000000', tags: { title: 'Main' } },
      { start_time: 'N/A', end_time: '1.0' }
    ] });
    expect(parseChapters(json)).toEqual([
      { title: 'Main', startMs: 0, endMs: 5_400_000 },
      { title: 'End Credits', startMs: 5_400_000, endMs: 6_000_000 }
    ]);
  });

  it('gives an empty list when the file has no chapters', () => {
    expect(parseChapters('{"chapters":[]}')).toEqual([]);
    expect(parseChapters('{}')).toEqual([]);
  });
});
