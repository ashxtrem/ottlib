import { useEffect, type RefObject } from 'react';

/** A mouse has to move this far sideways before a press becomes a drag (and stops being a click). */
export const dragThresholdPx = 5;
/** Glide stops once it is slower than this (px per ms). */
export const glideStopSpeed = 0.02;
const glideFrictionPerFrame = 0.95;
const frameMs = 1000 / 60;

export function isDragDistance(dx: number): boolean {
  return Math.abs(dx) > dragThresholdPx;
}

/** Speed after `dtMs` of glide friction; 0 once it is too slow to notice. */
export function nextGlideVelocity(velocity: number, dtMs: number): number {
  const next = velocity * Math.pow(glideFrictionPerFrame, dtMs / frameMs);
  return Math.abs(next) < glideStopSpeed ? 0 : next;
}

const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Mouse drag scrolls the row sideways and glides on release; a drag swallows the click. Touch keeps native scrolling. */
export function useRowDragScroll(listRef: RefObject<HTMLElement | null>): void {
  useEffect(() => listRef.current ? attachRowDragScroll(listRef.current) : undefined, [listRef]);
}

/** Wires drag scrolling onto a row element; returns the cleanup. */
export function attachRowDragScroll(el: HTMLElement): () => void {
  let start: { x: number; left: number } | null = null;
  let dragging = false;
  let swallowClick = false;
  let lastX = 0, lastT = 0, velocity = 0, frame = 0;
  let clickWindow: ReturnType<typeof setTimeout> | undefined;

  const settle = () => { el.style.scrollSnapType = ''; el.style.cursor = ''; el.style.userSelect = ''; };
  const stopGlide = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
  const glide = (from: number) => {
    let previous = from;
    const step = (now: number) => {
      const dt = Math.max(now - previous, 0); previous = now;
      const before = el.scrollLeft;
      el.scrollLeft += velocity * dt;
      velocity = nextGlideVelocity(velocity, dt);
      if (velocity === 0 || el.scrollLeft === before && dt > 0) { frame = 0; settle(); return; }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    stopGlide(); settle();
    start = { x: event.clientX, left: el.scrollLeft };
    dragging = false; swallowClick = false;
    lastX = event.clientX; lastT = event.timeStamp; velocity = 0;
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!start) return;
    // The button came up outside the row (pointerup never reached it): the press is over.
    if (!(event.buttons & 1)) { start = null; return; }
    const dx = event.clientX - start.x;
    if (!dragging) {
      if (!isDragDistance(dx)) return;
      dragging = true;
      el.setPointerCapture?.(event.pointerId);
      el.style.scrollSnapType = 'none'; el.style.cursor = 'grabbing'; el.style.userSelect = 'none';
    }
    el.scrollLeft = start.left - dx;
    const dt = event.timeStamp - lastT;
    if (dt > 0) velocity = (lastX - event.clientX) / dt;
    lastX = event.clientX; lastT = event.timeStamp;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!start) return;
    start = null;
    if (!dragging) return;
    dragging = false; swallowClick = true;
    // The click (if any) follows in the same task; after that a click is the keyboard's or a new press's.
    clearTimeout(clickWindow);
    clickWindow = setTimeout(() => { swallowClick = false; }, 0);
    if (el.hasPointerCapture?.(event.pointerId)) el.releasePointerCapture(event.pointerId);
    // A pause before letting go means no fling.
    if (event.timeStamp - lastT > 80 || prefersReducedMotion() || velocity === 0) { settle(); return; }
    glide(performance.now());
  };
  const onClick = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  const onDragStart = (event: DragEvent) => event.preventDefault();

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  el.addEventListener('click', onClick, true);
  el.addEventListener('dragstart', onDragStart);
  return () => {
    stopGlide(); clearTimeout(clickWindow);
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
    el.removeEventListener('click', onClick, true);
    el.removeEventListener('dragstart', onDragStart);
  };
}
