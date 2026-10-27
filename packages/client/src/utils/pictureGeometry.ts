import type { PictureArea } from '@ottlib/shared';
import { PICTURE_MODES, type PictureModeId, type PictureScaling } from './pictureModes';

/** Port of the Android `PictureGeometry`: how the video picture is fitted to the player box. Aspect ratios are width ÷ height. */

/** A rectangle in px, relative to the box's top-left corner. It may be larger than the box and start off it. */
export interface FrameRect {
  width: number;
  height: number;
  left: number;
  top: number;
}

/** The whole frame is the picture: what a null `pictureArea` means. */
export const WHOLE_FRAME: PictureArea = { x: 0, y: 0, width: 1, height: 1 };

/** The frame shape for Smart fill: the geometric mean of the video's and the box's aspect ratios. */
export function smartFillAspectRatio(videoAspect: number, screenAspect: number): number {
  return Math.sqrt(videoAspect * screenAspect);
}

/** Fraction of the picture cut off when a frame of `frameAspect` is zoomed to cover a `screenAspect` box. */
export function trimmedFraction(frameAspect: number, screenAspect: number): number {
  return 1 - Math.min(frameAspect, screenAspect) / Math.max(frameAspect, screenAspect);
}

/** How much the video's shape is distorted when drawn into a frame of `frameAspect` (0 = undistorted). */
export function distortion(videoAspect: number, frameAspect: number): number {
  return Math.max(videoAspect, frameAspect) / Math.min(videoAspect, frameAspect) - 1;
}

function fit(aspect: number, w: number, h: number): [number, number] {
  return aspect > w / h ? [w, w / aspect] : [h * aspect, h];
}

function cover(aspect: number, w: number, h: number): [number, number] {
  return aspect > w / h ? [h * aspect, h] : [w, w / aspect];
}

/**
 * Where to draw the whole video frame so that the real picture `area` (bars burned into the frame excluded) is fitted
 * to the box by `scaling`, or by `forcedAspect` when set.
 */
export function frameRect(scaling: PictureScaling, forcedAspect: number | null, videoAspect: number, area: PictureArea, boxW: number, boxH: number): FrameRect {
  const screenAspect = boxW / boxH;
  const active = (videoAspect * area.width) / area.height;
  let activeSize: [number, number];
  if (forcedAspect !== null) activeSize = fit(forcedAspect, boxW, boxH);
  else if (scaling === 'fit') activeSize = fit(active, boxW, boxH);
  else if (scaling === 'crop') activeSize = cover(active, boxW, boxH);
  else if (scaling === 'stretch') activeSize = [boxW, boxH];
  else activeSize = cover(smartFillAspectRatio(active, screenAspect), boxW, boxH);
  const width = activeSize[0] / area.width;
  const height = activeSize[1] / area.height;
  return {
    width,
    height,
    left: boxW / 2 - (area.x + area.width / 2) * width,
    top: boxH / 2 - (area.y + area.height / 2) * height
  };
}

export interface PictureLayoutInput {
  videoWidth: number;
  videoHeight: number;
  boxWidth: number;
  boxHeight: number;
  /** The detected picture area; null or undefined = the whole frame. */
  area: PictureArea | null | undefined;
  mode: PictureModeId;
}

/** The `<video>` rect for a mode, or null while the video or the box has no size yet (or the area is degenerate). */
export function pictureLayout({ videoWidth, videoHeight, boxWidth, boxHeight, area, mode }: PictureLayoutInput): FrameRect | null {
  if (!(videoWidth > 0 && videoHeight > 0 && boxWidth > 0 && boxHeight > 0)) return null;
  const picture = area && area.width > 0 && area.height > 0 ? area : WHOLE_FRAME;
  const { scaling, aspectRatio } = PICTURE_MODES.find((entry) => entry.id === mode) ?? PICTURE_MODES[0];
  return frameRect(scaling, aspectRatio, videoWidth / videoHeight, picture, boxWidth, boxHeight);
}
