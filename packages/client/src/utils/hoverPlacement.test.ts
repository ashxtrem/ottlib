import { describe, expect, it } from 'vitest';
import { estimatePreviewHeight, placePreview, previewWidth } from './hoverPlacement';

const viewport = { width: 1280, height: 800 };

describe('previewWidth', () => {
  it('grows the card 1.5x', () => {
    expect(previewWidth(200)).toBe(300);
    expect(previewWidth(240)).toBe(360);
  });

  it('holds the width between 240 and 420 px', () => {
    expect(previewWidth(144)).toBe(240);
    expect(previewWidth(100)).toBe(240);
    expect(previewWidth(300)).toBe(420);
  });

  it('never exceeds the viewport minus both margins', () => {
    expect(previewWidth(300, 320)).toBe(304);
  });
});

describe('placePreview', () => {
  it('centres the preview over a card in the middle of the viewport', () => {
    const placement = placePreview({ left: 560, top: 300, width: 160, height: 300 }, viewport, 200);
    expect(placement.width).toBe(240);
    expect(placement.left).toBe(520);
    expect(placement.top).toBe(350);
    expect(placement.originX).toBe(120);
    expect(placement.startScale).toBeCloseTo(160 / 240);
  });

  it('stays 8 px inside the left edge for the first card of a row', () => {
    const placement = placePreview({ left: 0, top: 300, width: 160, height: 300 }, viewport, 200);
    expect(placement.left).toBe(8);
    expect(placement.originX).toBe(72);
  });

  it('stays 8 px inside the right edge for the last card of a row', () => {
    const placement = placePreview({ left: 1200, top: 300, width: 160, height: 300 }, viewport, 200);
    expect(placement.left + placement.width).toBe(viewport.width - 8);
  });

  it('stays 8 px inside the top and bottom edges', () => {
    expect(placePreview({ left: 500, top: -100, width: 160, height: 240 }, viewport, 400).top).toBe(8);
    const low = placePreview({ left: 500, top: 700, width: 160, height: 240 }, viewport, 400);
    expect(low.top + 400).toBe(viewport.height - 8);
  });

  it('guesses a height from the width before measuring', () => {
    expect(estimatePreviewHeight(240)).toBe(305);
  });
});
