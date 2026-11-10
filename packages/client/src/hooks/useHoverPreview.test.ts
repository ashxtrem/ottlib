import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canHoverPreview, createHoverPreviewController, FINE_POINTER_QUERY, shouldArmHoverPreview, type HoverPreviewTimers } from './useHoverPreview';

const timers: HoverPreviewTimers = { set: (run, ms) => setTimeout(run, ms) as unknown as number, clear: (id) => clearTimeout(id) };

describe('canHoverPreview', () => {
  const fine = (query: string) => ({ matches: query === FINE_POINTER_QUERY });
  const coarse = () => ({ matches: false });

  it('allows a mouse on a fine, hovering pointer', () => {
    expect(canHoverPreview('mouse', fine, true)).toBe(true);
  });

  it('refuses touch, pen, coarse pointers and selection mode', () => {
    expect(canHoverPreview('touch', fine, true)).toBe(false);
    expect(canHoverPreview('pen', fine, true)).toBe(false);
    expect(canHoverPreview('mouse', coarse, true)).toBe(false);
    expect(canHoverPreview('mouse', undefined, true)).toBe(false);
    expect(canHoverPreview('mouse', fine, false)).toBe(false);
  });

  it('does not arm while a mouse button is held (press or row drag-scroll)', () => {
    expect(shouldArmHoverPreview(0, 'mouse', fine, true)).toBe(true);
    expect(shouldArmHoverPreview(1, 'mouse', fine, true)).toBe(false);
  });
});

describe('createHoverPreviewController', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function setup() {
    const onOpen = vi.fn(); const onClose = vi.fn();
    return { onOpen, onClose, controller: createHoverPreviewController(onOpen, onClose, timers) };
  }

  it('opens only after the pointer rests 400 ms', () => {
    const { onOpen, controller } = setup();
    controller.rest();
    vi.advanceTimersByTime(300);
    controller.rest();
    vi.advanceTimersByTime(399);
    expect(onOpen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(controller.open).toBe(true);
  });

  it('never opens when the pointer leaves first', () => {
    const { onOpen, controller } = setup();
    controller.rest();
    controller.leave();
    vi.advanceTimersByTime(1000);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('closes 150 ms after leaving unless the pointer enters the preview', () => {
    const { onClose, controller } = setup();
    controller.rest(); vi.advanceTimersByTime(400);
    controller.leave(); vi.advanceTimersByTime(100);
    controller.stay(); vi.advanceTimersByTime(500);
    expect(onClose).not.toHaveBeenCalled();
    controller.leave(); vi.advanceTimersByTime(149);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(controller.open).toBe(false);
  });

  it('cancels a pending dwell on close (pointerdown)', () => {
    const { onOpen, controller } = setup();
    controller.rest(); vi.advanceTimersByTime(200);
    controller.close(); vi.advanceTimersByTime(1000);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('closes at once on close (Esc, scroll)', () => {
    const { onClose, controller } = setup();
    controller.rest(); vi.advanceTimersByTime(400);
    controller.close();
    expect(onClose).toHaveBeenCalledTimes(1);
    controller.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
