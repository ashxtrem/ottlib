import { describe, expect, it } from 'vitest';
import { fragment, initSegment } from './fmp4Fixture.js';
import { Fmp4Splitter } from './fmp4Splitter.js';

describe('Fmp4Splitter', () => {
  it('emits the init segment and each moof+mdat with its first video presentation time', () => {
    const splitter = new Fmp4Splitter(10_000);
    const pieces = splitter.push(Buffer.concat([initSegment(), fragment(0), fragment(2002.5)]));
    expect(pieces.map((piece) => piece.kind)).toEqual(['init', 'fragment', 'fragment']);
    expect(pieces[0].bytes.equals(initSegment())).toBe(true);
    expect(pieces[1]).toMatchObject({ startMs: 0 });
    expect((pieces[2] as { startMs: number }).startMs).toBeCloseTo(2002.5, 1);
    expect(pieces[1].bytes.equals(fragment(0))).toBe(true);
  });

  it('waits for a box split across chunks', () => {
    const splitter = new Fmp4Splitter(10_000);
    const data = Buffer.concat([initSegment(), fragment(4000, Buffer.alloc(50_000, 7))]);
    const pieces = [];
    for (let at = 0; at < data.length; at += 7) pieces.push(...splitter.push(data.subarray(at, at + 7)));
    expect(pieces.map((piece) => piece.kind)).toEqual(['init', 'fragment']);
    expect(pieces[1].bytes.length).toBe(fragment(4000, Buffer.alloc(50_000, 7)).length);
  });
});
