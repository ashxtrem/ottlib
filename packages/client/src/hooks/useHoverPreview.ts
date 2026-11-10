import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { AnchorRect } from '../utils/hoverPlacement';

export const HOVER_PREVIEW_DELAY_MS = 400;
export const HOVER_PREVIEW_GRACE_MS = 150;
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

type MatchMedia = (query: string) => { matches: boolean };

/** Only a mouse on a device whose primary pointer hovers finely; never touch or pen, never while selecting. */
export function canHoverPreview(pointerType: string, matchMedia: MatchMedia | undefined, enabled: boolean): boolean {
  return enabled && pointerType === 'mouse' && typeof matchMedia === 'function' && matchMedia(FINE_POINTER_QUERY).matches;
}

/** The dwell only runs while no mouse button is held (a press or a row drag-scroll in progress). */
export function shouldArmHoverPreview(buttons: number, pointerType: string, matchMedia: MatchMedia | undefined, enabled: boolean): boolean {
  return buttons === 0 && canHoverPreview(pointerType, matchMedia, enabled);
}

export interface HoverPreviewTimers { set: (run: () => void, ms: number) => number; clear: (id: number | undefined) => void }

/**
 * The open/close timing, free of React and the DOM: `rest` (re)starts the 400 ms dwell, `leave`
 * closes after a 150 ms grace unless `stay` cancels it, `close` shuts at once (Esc, scroll).
 */
export function createHoverPreviewController(onOpen: () => void, onClose: () => void, timers: HoverPreviewTimers) {
  let openTimer: number | undefined;
  let closeTimer: number | undefined;
  let open = false;
  const cancel = () => { timers.clear(openTimer); timers.clear(closeTimer); openTimer = undefined; closeTimer = undefined; };
  return {
    get open() { return open; },
    rest() {
      timers.clear(closeTimer); closeTimer = undefined;
      if (open) return;
      timers.clear(openTimer);
      openTimer = timers.set(() => { openTimer = undefined; open = true; onOpen(); }, HOVER_PREVIEW_DELAY_MS);
    },
    stay() { timers.clear(closeTimer); closeTimer = undefined; },
    leave() {
      timers.clear(openTimer); openTimer = undefined;
      if (!open) return;
      timers.clear(closeTimer);
      closeTimer = timers.set(() => { closeTimer = undefined; open = false; onClose(); }, HOVER_PREVIEW_GRACE_MS);
    },
    close() { cancel(); if (!open) return; open = false; onClose(); },
    dispose: cancel
  };
}

const browserTimers: HoverPreviewTimers = { set: (run, ms) => window.setTimeout(run, ms), clear: (id) => window.clearTimeout(id) };

/** Hover preview state for one card. Spread `cardHandlers` on the card and `previewHandlers` on the preview. */
export function useHoverPreview(enabled: boolean) {
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const card = useRef<HTMLElement | null>(null);
  const controller = useMemo(() => createHoverPreviewController(() => {
    const rect = card.current?.getBoundingClientRect();
    setAnchor(rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null);
  }, () => setAnchor(null), browserTimers), []);
  const close = useCallback(() => controller.close(), [controller]);

  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => { if (!enabled) controller.close(); }, [controller, enabled]);
  useEffect(() => {
    if (!anchor) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') controller.close(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [anchor, close, controller]);

  const rest = (event: PointerEvent<HTMLElement>) => {
    if (!shouldArmHoverPreview(event.buttons, event.pointerType, typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined, enabled)) return;
    card.current = event.currentTarget;
    controller.rest();
  };
  return {
    anchor,
    close,
    cardHandlers: { onPointerEnter: rest, onPointerMove: rest, onPointerDown: close, onPointerLeave: () => controller.leave() },
    previewHandlers: { onPointerEnter: () => controller.stay(), onPointerLeave: () => controller.leave() }
  };
}

export type HoverPreview = ReturnType<typeof useHoverPreview>;
