/** What a key press on the watch page does. */
export type ShortcutAction =
  | 'toggle-play'
  | 'seek-back'
  | 'seek-forward'
  | 'volume-up'
  | 'volume-down'
  | 'fullscreen'
  | 'mute'
  | 'subtitles'
  | 'exit-fullscreen'
  | 'back';

export interface ShortcutKey {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** Tag name of the focused element (e.g. `INPUT`, `BUTTON`). */
  targetTag?: string;
  /** `type` of a focused input: a slider (`range`) keeps only the arrow keys. */
  targetType?: string;
}

/** Seconds a ←/→ key or a double tap jumps. */
export const SEEK_STEP_SECONDS = 10;
/** Volume change per ↑/↓ press (volume is 0–1). */
export const VOLUME_STEP = 0.1;

const keyActions: Record<string, ShortcutAction> = {
  ' ': 'toggle-play',
  k: 'toggle-play',
  ArrowLeft: 'seek-back',
  ArrowRight: 'seek-forward',
  ArrowUp: 'volume-up',
  ArrowDown: 'volume-down',
  f: 'fullscreen',
  m: 'mute',
  c: 'subtitles'
};

/**
 * Space/K play-pause, ←/→ 10 s, ↑/↓ volume, F fullscreen, M mute, C subtitles on/off, Esc leaves fullscreen and then
 * goes back. Keys with Ctrl/Cmd/Alt stay with the browser; a focused text field keeps its keys, a focused slider (seek,
 * volume) keeps the arrows, and a focused button keeps Space/Enter (it presses the button).
 */
export function shortcutAction(press: ShortcutKey, fullscreen: boolean): ShortcutAction | null {
  if (press.ctrlKey || press.metaKey || press.altKey) return null;
  const tag = press.targetTag?.toUpperCase();
  const slider = tag === 'INPUT' && press.targetType === 'range';
  if (slider && press.key.startsWith('Arrow')) return null;
  if (!slider && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return null;
  if (press.key === 'Escape') return fullscreen ? 'exit-fullscreen' : 'back';
  if (tag === 'BUTTON' && (press.key === ' ' || press.key === 'Enter')) return null;
  const key = press.key.length === 1 ? press.key.toLowerCase() : press.key;
  return keyActions[key] ?? null;
}

/** The next volume after a step, kept in 0–1 and rounded to tenths so repeated steps land on 0 and 1 exactly. */
export function stepVolume(volume: number, delta: number): number {
  return Math.min(1, Math.max(0, Math.round((volume + delta) * 10) / 10));
}

/** A double tap in the left third jumps back, in the right third forward, in the middle nothing (phone width). */
export function doubleTapSeekSeconds(x: number, width: number): number {
  if (width <= 0) return 0;
  if (x < width / 3) return -SEEK_STEP_SECONDS;
  if (x > (width * 2) / 3) return SEEK_STEP_SECONDS;
  return 0;
}

/** Two taps this close together (ms) are a double tap. */
export const DOUBLE_TAP_MS = 300;
