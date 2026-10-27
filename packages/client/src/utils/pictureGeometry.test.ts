import type { PictureArea } from '@ottlib/shared';
import { describe, expect, it } from 'vitest';
import { distortion, frameRect, pictureLayout, smartFillAspectRatio, trimmedFraction, type FrameRect } from './pictureGeometry';
import { PICTURE_MODES, type PictureModeId } from './pictureModes';

// Ports of the Android PictureGeometryTest cases, with the same numbers.
const screen = 16 / 9;
// Mummy 4K: a 3840×2160 frame holding a 3840×1632 picture at y=264.
const mummy: PictureArea = { x: 0, y: 0.1222, width: 1, height: 0.7556 };
const wholeFrame: PictureArea = { x: 0, y: 0, width: 1, height: 1 };

function rect(modeId: PictureModeId, video: number, area: PictureArea, w = 1920, h = 1080): FrameRect {
  const mode = PICTURE_MODES.find((entry) => entry.id === modeId)!;
  return frameRect(mode.scaling, mode.aspectRatio, video, area, w, h);
}

/** Every side within 1 px, like the Kotlin assertRect. */
function expectRect(actual: FrameRect, expected: FrameRect): void {
  expect(actual.width).toBeCloseTo(expected.width, -0.3);
  expect(actual.height).toBeCloseTo(expected.height, -0.3);
  expect(actual.left).toBeCloseTo(expected.left, -0.3);
  expect(actual.top).toBeCloseTo(expected.top, -0.3);
}

/** The on-screen rectangle of the real picture inside a placed frame. */
function activeOnScreen(frame: FrameRect, area: PictureArea): FrameRect {
  return { width: frame.width * area.width, height: frame.height * area.height, left: frame.left + area.x * frame.width, top: frame.top + area.y * frame.height };
}

function near(actual: number, expected: number, tolerance = 1): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe('smart fill maths', () => {
  it('splits a scope film between trim and stretch', () => {
    const scope = 2.4;
    const frame = smartFillAspectRatio(scope, screen);
    near(trimmedFraction(scope, screen), 0.26, 0.01);
    near(distortion(scope, screen), 0.35, 0.01);
    near(trimmedFraction(frame, screen), 0.14, 0.01);
    near(distortion(scope, frame), 0.16, 0.01);
  });

  it('works for narrower content too', () => {
    const standard = 4 / 3;
    const frame = smartFillAspectRatio(standard, screen);
    expect(frame > standard && frame < screen).toBe(true);
    near(trimmedFraction(frame, screen), 0.13, 0.01);
  });

  it('needs neither trim nor stretch when the shapes match', () => {
    const frame = smartFillAspectRatio(screen, screen);
    near(frame, screen, 0.0001);
    near(trimmedFraction(frame, screen), 0, 0.0001);
    near(distortion(screen, frame), 0, 0.0001);
  });
});

describe('frameRect with a picture area', () => {
  it('Fit fits the real picture', () => {
    const frame = rect('Fit', screen, mummy);
    near(frame.width, 1920); near(frame.height, 1080); near(frame.left, 0); near(frame.top, 0);
    const active = activeOnScreen(frame, mummy);
    near(active.width, 1920);
    near(active.height, 816);
    near(active.top, 132);
  });

  it('Zoom covers the box with the real picture', () => {
    const frame = rect('Zoom', screen, mummy);
    near(frame.height, 1080 / 0.7556); // ≈ 1429: the frame is taller than the box
    const active = activeOnScreen(frame, mummy);
    near(active.height, 1080);
    near(active.top, 0);
    near(active.left + active.width / 2, 1920 / 2);
    expect(active.width).toBeGreaterThan(1920);
  });

  it('Stretch fills the box with the real picture', () => {
    const active = activeOnScreen(rect('Stretch', screen, mummy), mummy);
    near(active.width, 1920); near(active.height, 1080); near(active.left, 0); near(active.top, 0);
  });

  it('Smart fill covers the box at the mean shape', () => {
    const active = activeOnScreen(rect('SmartFill', screen, mummy), mummy);
    const mean = smartFillAspectRatio(screen / 0.7556, screen);
    near(active.height, 1080);
    near(active.width, 1080 * mean);
    near(active.left + active.width / 2, 960);
  });

  it('a forced ratio fits that ratio with the real picture', () => {
    const active = activeOnScreen(rect('Standard', screen, mummy), mummy);
    near(active.width, 1440); near(active.height, 1080); near(active.left, 240); near(active.top, 0);
  });

  it('a wider box shows the real picture wider', () => {
    const sixteenNine = activeOnScreen(rect('Fit', screen, mummy), mummy);
    const twentyNine = activeOnScreen(rect('Fit', screen, mummy, 2400, 1080), mummy);
    expect(twentyNine.width).toBeGreaterThan(sixteenNine.width);
    near(twentyNine.width, 2400);
    near(twentyNine.left, 0);
  });
});

describe('frameRect with the whole frame as the area', () => {
  it('matches the plain fit and zoom', () => {
    const scope = 2.4;
    expectRect(rect('Fit', scope, wholeFrame), { width: 1920, height: 800, left: 0, top: 140 });
    expectRect(rect('Zoom', scope, wholeFrame), { width: 2592, height: 1080, left: -336, top: 0 });
    expectRect(rect('Fit', screen, wholeFrame), { width: 1920, height: 1080, left: 0, top: 0 });
  });

  it('forces 16:9, 4:3 and 2.39:1 inside the box', () => {
    expectRect(rect('Wide', 2.4, wholeFrame), { width: 1920, height: 1080, left: 0, top: 0 });
    expectRect(rect('Standard', 2.4, wholeFrame), { width: 1440, height: 1080, left: 240, top: 0 });
    expectRect(rect('Cinema', 2.4, wholeFrame), { width: 1920, height: 1920 / 2.39, left: 0, top: (1080 - 1920 / 2.39) / 2 });
  });
});

describe('pictureLayout', () => {
  it('reads the video size, treats a null area as the whole frame and follows the box size', () => {
    const input = { videoWidth: 1920, videoHeight: 800, boxWidth: 1920, boxHeight: 1080, mode: 'Zoom' as const };
    expect(pictureLayout({ ...input, area: null })).toEqual(frameRect('crop', null, 2.4, wholeFrame, 1920, 1080));
    expect(pictureLayout({ ...input, area: undefined })).toEqual(pictureLayout({ ...input, area: wholeFrame }));
    // A phone-width portrait box: the same film is zoomed to the box height and trimmed at the sides.
    const phone = pictureLayout({ ...input, boxWidth: 390, boxHeight: 844, area: null })!;
    near(phone.height, 844, 0.001);
    expect(phone.left).toBeLessThan(0);
  });

  it('is null until the video and the box have a size', () => {
    const input = { videoWidth: 1920, videoHeight: 1080, boxWidth: 800, boxHeight: 450, area: null, mode: 'Fit' as const };
    expect(pictureLayout(input)).not.toBeNull();
    expect(pictureLayout({ ...input, videoWidth: 0 })).toBeNull();
    expect(pictureLayout({ ...input, boxHeight: 0 })).toBeNull();
  });

  it('ignores a degenerate area', () => {
    const input = { videoWidth: 1920, videoHeight: 1080, boxWidth: 800, boxHeight: 450, mode: 'Fit' as const };
    expect(pictureLayout({ ...input, area: { x: 0, y: 0, width: 0, height: 0 } })).toEqual(pictureLayout({ ...input, area: null }));
  });
});
