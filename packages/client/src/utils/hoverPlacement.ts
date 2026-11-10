/** Geometry for the poster hover preview: 1.5x the card, 240-420 px wide, kept a margin inside the viewport. */
export const PREVIEW_SCALE = 1.5;
export const PREVIEW_MIN_WIDTH = 240;
export const PREVIEW_MAX_WIDTH = 420;
export const VIEWPORT_MARGIN = 8;

export interface AnchorRect { left: number; top: number; width: number; height: number }
export interface Viewport { width: number; height: number }
export interface PreviewPlacement { left: number; top: number; width: number; originX: number; originY: number; startScale: number }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** 1.5x the card width, held to 240-420 px and never wider than the viewport minus both margins. */
export function previewWidth(cardWidth: number, viewportWidth = Number.POSITIVE_INFINITY): number {
  const width = clamp(Math.round(cardWidth * PREVIEW_SCALE), PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH);
  return Math.max(0, Math.min(width, viewportWidth - VIEWPORT_MARGIN * 2));
}

/** A first height guess before the preview is measured: 16:9 backdrop plus the text and buttons. */
export function estimatePreviewHeight(width: number): number {
  return Math.round(width * 9 / 16) + 170;
}

/**
 * Centres the preview over the card, then slides it back inside the viewport so it stays
 * `VIEWPORT_MARGIN` px from every edge (a row's first and last cards included). The origin points
 * at the card's centre so the preview grows out of the card.
 */
export function placePreview(card: AnchorRect, viewport: Viewport, height = estimatePreviewHeight(previewWidth(card.width, viewport.width))): PreviewPlacement {
  const width = previewWidth(card.width, viewport.width);
  const centerX = card.left + card.width / 2;
  const centerY = card.top + card.height / 2;
  const left = clamp(centerX - width / 2, VIEWPORT_MARGIN, viewport.width - VIEWPORT_MARGIN - width);
  const top = clamp(centerY - height / 2, VIEWPORT_MARGIN, viewport.height - VIEWPORT_MARGIN - height);
  return { left, top, width, originX: centerX - left, originY: centerY - top, startScale: width > 0 ? Math.min(1, card.width / width) : 1 };
}
