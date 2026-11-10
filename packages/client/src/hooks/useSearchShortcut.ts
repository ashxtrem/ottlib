import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { librarySearchInputId } from '../components/LibrarySearchInput';

interface ShortcutEvent { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; isComposing?: boolean }
interface TargetLike { tagName?: string; isContentEditable?: boolean }

const textFieldTags = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Typing in a field must never trigger a shortcut. */
export function isTextFieldTarget(target: TargetLike | null): boolean {
  if (!target) return false;
  return textFieldTags.has((target.tagName ?? '').toUpperCase()) || target.isContentEditable === true;
}

/** `/`, or Ctrl/Cmd+K. */
export function isSearchShortcut(event: ShortcutEvent): boolean {
  if (event.isComposing || event.altKey) return false;
  if (event.key === '/') return !event.ctrlKey && !event.metaKey;
  return event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.shiftKey;
}

/** What the shortcut does on this page: focus the search box here, or go to the library first. `null` leaves the key alone. */
export function searchShortcutAction(event: ShortcutEvent, target: TargetLike | null, pathname: string): 'focus' | 'navigate' | null {
  if (!isSearchShortcut(event) || isTextFieldTarget(target)) return null;
  return pathname === '/library' ? 'focus' : 'navigate';
}

function focusSearch(): boolean {
  const input = document.getElementById(librarySearchInputId);
  if (!(input instanceof HTMLInputElement)) return false;
  input.focus(); input.select();
  return true;
}

/** The library page draws its search box a moment after navigating, so keep looking for a few frames. */
function focusSearchWhenReady(attemptsLeft = 60): void {
  if (focusSearch() || attemptsLeft <= 0) return;
  window.requestAnimationFrame(() => focusSearchWhenReady(attemptsLeft - 1));
}

/** Mounted in the header layout: `/` and Ctrl/Cmd+K focus the library search from any page that has the header. */
export function useSearchShortcut() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = searchShortcutAction(event, event.target instanceof HTMLElement ? event.target : null, pathname);
      if (!action) return;
      event.preventDefault();
      if (action === 'navigate') navigate('/library');
      focusSearchWhenReady();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pathname, navigate]);
}
