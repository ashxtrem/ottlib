import { describe, expect, it } from 'vitest';
import { parseCropLine, unionArea } from './pictureAreaMath.js';

const realStderr = [
  'Input #0, matroska,webm, from \'The.Mummy.2017.2160p.mkv\':',
  '[Parsed_cropdetect_0 @ 0000019a3c0f6c40] x1:0 x2:3839 y1:264 y2:1895 w:3840 h:1632 x:0 y:264 pts:3606 t:150.375000 limit:0.100000 crop=3840:1632:0:264',
  '[Parsed_cropdetect_0 @ 0000019a3c0f6c40] x1:0 x2:3839 y1:264 y2:1895 w:3840 h:1632 x:0 y:264 pts:3630 t:151.375000 limit:0.100000 crop=3840:1632:0:264',
  'frame=    3 fps=1.2 q=-0.0 Lsize=N/A time=00:00:00.12 bitrate=N/A speed=0.05x'
].join('\n');

describe('parseCropLine', () => {
  it('reads the last crop box of a real cropdetect run', () => {
    expect(parseCropLine(realStderr)).toEqual({ w: 3840, h: 1632, x: 0, y: 264 });
  });

  it('takes the last box when the detection settles over several frames', () => {
    expect(parseCropLine('limit:0.1 crop=3840:2160:0:0\nlimit:0.1 crop=3840:1632:0:264')).toEqual({ w: 3840, h: 1632, x: 0, y: 264 });
  });

  it('returns null when there is no crop line', () => {
    expect(parseCropLine('Error opening input file')).toBeNull();
    expect(parseCropLine('')).toBeNull();
  });
});

describe('unionArea', () => {
  const mummy = [
    { w: 3840, h: 1632, x: 0, y: 264 },
    { w: 2406, h: 1632, x: 717, y: 264 },
    { w: 2826, h: 898, x: 507, y: 632 }
  ];

  it('unions dark-scene samples into the full picture: Mummy 4K is 3840x1632 at y=264', () => {
    expect(unionArea(mummy, 3840, 2160)).toEqual({ status: 'done', area: { x: 0, y: 264, width: 3840, height: 1632 } });
  });

  it('does not need the full-width sample when the others together span it', () => {
    const samples = [{ w: 2406, h: 1632, x: 0, y: 264 }, { w: 2406, h: 1632, x: 1434, y: 264 }, { w: 2826, h: 898, x: 507, y: 632 }];
    expect(unionArea(samples, 3840, 2160)).toEqual({ status: 'done', area: { x: 0, y: 264, width: 3840, height: 1632 } });
  });

  it('ignores bars thinner than 1% per side: status none, no area', () => {
    const samples = [{ w: 1920, h: 1072, x: 0, y: 4 }, { w: 1920, h: 1076, x: 0, y: 2 }, { w: 1916, h: 1080, x: 2, y: 0 }];
    expect(unionArea(samples, 1920, 1080)).toEqual({ status: 'none', area: null });
  });

  it('snaps a thin side to the frame edge but keeps a real bar on the other', () => {
    const samples = Array.from({ length: 3 }, () => ({ w: 1920, h: 930, x: 0, y: 140 }));
    expect(unionArea(samples, 1920, 1080)).toEqual({ status: 'done', area: { x: 0, y: 140, width: 1920, height: 940 } });
  });

  it('fails when the union is narrower or shorter than half the frame', () => {
    const narrow = Array.from({ length: 4 }, () => ({ w: 800, h: 1080, x: 560, y: 0 }));
    const short = Array.from({ length: 4 }, () => ({ w: 1920, h: 400, x: 0, y: 340 }));
    expect(unionArea(narrow, 1920, 1080)).toEqual({ status: 'failed', area: null });
    expect(unionArea(short, 1920, 1080)).toEqual({ status: 'failed', area: null });
  });

  it('fails with fewer than 3 usable samples', () => {
    expect(unionArea(mummy.slice(0, 2), 3840, 2160)).toEqual({ status: 'failed', area: null });
    expect(unionArea([], 3840, 2160)).toEqual({ status: 'failed', area: null });
    const outside = [...mummy.slice(0, 2), { w: 5000, h: 1632, x: 0, y: 264 }];
    expect(unionArea(outside, 3840, 2160)).toEqual({ status: 'failed', area: null });
  });

  it('keeps pillarbox bars: 4:3 in a 16:9 frame has x > 0', () => {
    const samples = Array.from({ length: 3 }, () => ({ w: 1440, h: 1080, x: 240, y: 0 }));
    const result = unionArea(samples, 1920, 1080);
    expect(result).toEqual({ status: 'done', area: { x: 240, y: 0, width: 1440, height: 1080 } });
    expect(result.area!.x).toBeGreaterThan(0);
  });
});
