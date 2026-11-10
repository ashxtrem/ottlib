import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachRowDragScroll, dragThresholdPx, isDragDistance, nextGlideVelocity } from './useRowDragScroll';

class FakeRow extends EventTarget {
  scrollLeft = 200;
  style = { scrollSnapType: '', cursor: '', userSelect: '' };
  setPointerCapture = vi.fn();
  hasPointerCapture = () => true;
  releasePointerCapture = vi.fn();
}

/** `buttons` defaults to the primary button held while pressing or moving, and none on release. */
function pointer(type: string, clientX: number, timeStamp: number, pointerType = 'mouse', buttons = type === 'pointerup' || type === 'pointercancel' ? 0 : 1) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, { clientX: { value: clientX }, timeStamp: { value: timeStamp }, pointerType: { value: pointerType }, button: { value: 0 }, buttons: { value: buttons }, pointerId: { value: 1 } });
  return event;
}

function click(row: FakeRow) {
  const event = new Event('click', { cancelable: true });
  const reached = vi.fn();
  row.addEventListener('click', reached);
  row.dispatchEvent(event);
  row.removeEventListener('click', reached);
  return { prevented: event.defaultPrevented, reached: reached.mock.calls.length > 0 };
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('drag threshold', () => {
  it('needs more than 5 px sideways', () => {
    expect(dragThresholdPx).toBe(5);
    expect(isDragDistance(5)).toBe(false);
    expect(isDragDistance(-5)).toBe(false);
    expect(isDragDistance(6)).toBe(true);
    expect(isDragDistance(-6)).toBe(true);
  });
});

describe('glide', () => {
  it('slows down each frame and stops when too slow to notice', () => {
    const next = nextGlideVelocity(2, 1000 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(2);
    expect(nextGlideVelocity(-2, 1000 / 60)).toBeLessThan(0);
    expect(nextGlideVelocity(0.0201, 1000 / 60)).toBe(0);
    let velocity = 3; let frames = 0;
    while (velocity !== 0 && frames < 1000) { velocity = nextGlideVelocity(velocity, 1000 / 60); frames += 1; }
    expect(frames).toBeLessThan(200);
  });
});

describe('attachRowDragScroll', () => {
  it('scrolls the row with a mouse drag and swallows the click that follows', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const row = new FakeRow();
    const detach = attachRowDragScroll(row as unknown as HTMLElement);
    row.dispatchEvent(pointer('pointerdown', 300, 0));
    row.dispatchEvent(pointer('pointermove', 260, 16));
    expect(row.scrollLeft).toBe(240);
    expect(row.style.scrollSnapType).toBe('none');
    row.dispatchEvent(pointer('pointerup', 260, 20));
    expect(row.style.scrollSnapType).toBe('');
    expect(click(row)).toEqual({ prevented: true, reached: false });
    // Only that one click: the next one opens the card as usual.
    expect(click(row)).toEqual({ prevented: false, reached: true });
    detach();
  });

  it('does not drag once the button came up outside the row', () => {
    const row = new FakeRow();
    attachRowDragScroll(row as unknown as HTMLElement);
    row.dispatchEvent(pointer('pointerdown', 300, 0));
    // Released off the row: no pointerup here, the next move arrives with no button held.
    row.dispatchEvent(pointer('pointermove', 200, 16, 'mouse', 0));
    row.dispatchEvent(pointer('pointermove', 150, 32, 'mouse', 0));
    expect(row.scrollLeft).toBe(200);
    expect(row.setPointerCapture).not.toHaveBeenCalled();
    // A later press still drags as usual.
    row.dispatchEvent(pointer('pointerdown', 300, 40));
    row.dispatchEvent(pointer('pointermove', 260, 56));
    expect(row.scrollLeft).toBe(240);
  });

  it('lets a keyboard click through after a drag ended by pointercancel', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const row = new FakeRow();
    const detach = attachRowDragScroll(row as unknown as HTMLElement);
    row.dispatchEvent(pointer('pointerdown', 300, 0));
    row.dispatchEvent(pointer('pointermove', 260, 16));
    row.dispatchEvent(pointer('pointercancel', 260, 20));
    vi.runAllTimers();
    // Enter on a card fires a click with no press before it.
    expect(click(row)).toEqual({ prevented: false, reached: true });
    detach();
  });

  it('leaves a press that moved 5 px or less as a click', () => {
    const row = new FakeRow();
    attachRowDragScroll(row as unknown as HTMLElement);
    row.dispatchEvent(pointer('pointerdown', 300, 0));
    row.dispatchEvent(pointer('pointermove', 296, 16));
    row.dispatchEvent(pointer('pointerup', 296, 20));
    expect(row.scrollLeft).toBe(200);
    expect(click(row)).toEqual({ prevented: false, reached: true });
  });

  it('leaves touch to native scrolling', () => {
    const row = new FakeRow();
    attachRowDragScroll(row as unknown as HTMLElement);
    row.dispatchEvent(pointer('pointerdown', 300, 0, 'touch'));
    row.dispatchEvent(pointer('pointermove', 200, 16, 'touch'));
    expect(row.scrollLeft).toBe(200);
    expect(row.setPointerCapture).not.toHaveBeenCalled();
  });

  it('does not glide under reduced motion', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const raf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    const row = new FakeRow();
    attachRowDragScroll(row as unknown as HTMLElement);
    row.dispatchEvent(pointer('pointerdown', 300, 0));
    row.dispatchEvent(pointer('pointermove', 200, 16));
    row.dispatchEvent(pointer('pointerup', 190, 20));
    expect(raf).not.toHaveBeenCalled();
  });

  it('glides after a quick fling', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    const raf = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', raf);
    const row = new FakeRow();
    attachRowDragScroll(row as unknown as HTMLElement);
    row.dispatchEvent(pointer('pointerdown', 300, 0));
    row.dispatchEvent(pointer('pointermove', 200, 16));
    row.dispatchEvent(pointer('pointerup', 190, 20));
    expect(raf).toHaveBeenCalledOnce();
  });
});
