import { useEffect, useRef } from 'react';
import { shortcutAction, type ShortcutAction } from '../utils/playerShortcuts';

/**
 * Keyboard shortcuts of the watch page (see `shortcutAction`). Off while `enabled` is false (e.g. a track menu is open
 * and owns Escape and the arrows). Handlers are read through a ref, so callers may pass a fresh object each render.
 */
export function usePlayerShortcuts(handlers: Record<ShortcutAction, () => void>, fullscreen: boolean, enabled: boolean): void {
  const latest = useRef({ handlers, fullscreen, enabled });
  latest.current = { handlers, fullscreen, enabled };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current;
      if (!current.enabled || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const action = shortcutAction({ key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, targetTag: target?.tagName, targetType: target instanceof HTMLInputElement ? target.type : undefined }, current.fullscreen);
      if (!action) return;
      event.preventDefault();
      current.handlers[action]();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
