import { pictureAreaConfig } from '../../config/pictureArea.js';
import type { PictureArea, PictureStatus } from '../../repositories/movieRepository.js';

/** One cropdetect result: the box that holds the picture in a sampled frame. */
export interface CropBox { w: number; h: number; x: number; y: number }

export interface PictureAreaResult { status: Extract<PictureStatus, 'done' | 'none' | 'failed'>; area: PictureArea | null }

/** The last `crop=w:h:x:y` in ffmpeg's cropdetect output (it settles over the frames), or null when there is none. */
export function parseCropLine(stderr: string): CropBox | null {
  let last: RegExpExecArray | null = null;
  for (const match of stderr.matchAll(/crop=(-?\d+):(-?\d+):(-?\d+):(-?\d+)/g)) last = match as unknown as RegExpExecArray;
  if (!last) return null;
  return { w: Number(last[1]), h: Number(last[2]), x: Number(last[3]), y: Number(last[4]) };
}

/**
 * Union of the sampled boxes (dark scenes crop too tightly, so the widest box wins) against the frame.
 * Too few usable samples or a union under half the frame is `failed`; bars under 1% per side are ignored, and no bars left is `none`.
 */
export function unionArea(samples: readonly CropBox[], frameW: number, frameH: number, config = pictureAreaConfig): PictureAreaResult {
  const usable = samples.filter((box) => box.w > 0 && box.h > 0 && box.x >= 0 && box.y >= 0 && box.x + box.w <= frameW && box.y + box.h <= frameH);
  if (frameW <= 0 || frameH <= 0 || usable.length < config.minValidSamples) return { status: 'failed', area: null };
  const left = Math.min(...usable.map((box) => box.x));
  const top = Math.min(...usable.map((box) => box.y));
  const right = Math.max(...usable.map((box) => box.x + box.w));
  const bottom = Math.max(...usable.map((box) => box.y + box.h));
  if (right - left < frameW * config.minAreaFraction || bottom - top < frameH * config.minAreaFraction) return { status: 'failed', area: null };
  const x = left < frameW * config.minBarFraction ? 0 : left;
  const y = top < frameH * config.minBarFraction ? 0 : top;
  const x2 = frameW - right < frameW * config.minBarFraction ? frameW : right;
  const y2 = frameH - bottom < frameH * config.minBarFraction ? frameH : bottom;
  if (x === 0 && y === 0 && x2 === frameW && y2 === frameH) return { status: 'none', area: null };
  return { status: 'done', area: { x, y, width: x2 - x, height: y2 - y } };
}
