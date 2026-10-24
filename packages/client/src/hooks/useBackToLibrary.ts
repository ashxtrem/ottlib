import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function getTitleOriginScrollPosition(state: unknown): number | undefined {
  if (typeof state !== 'object' || state === null || !('fromLibrary' in state) || state.fromLibrary !== true || !('libraryScrollY' in state)) return undefined;
  return typeof state.libraryScrollY === 'number' && Number.isFinite(state.libraryScrollY) && state.libraryScrollY >= 0 ? state.libraryScrollY : undefined;
}

function getTitleOriginSearch(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('librarySearch' in state) || typeof state.librarySearch !== 'string') return '';
  return state.librarySearch.startsWith('?') ? state.librarySearch : '';
}

/** Where a title was opened from: the home rows ('/') or the library grid ('/library', the default). */
function getTitleOriginPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('libraryPath' in state)) return '/library';
  return state.libraryPath === '/' ? '/' : '/library';
}

/** The shelf a title was opened from, if any. */
export function getTitleOriginShelfId(state: unknown): number | undefined {
  if (typeof state !== 'object' || state === null || !('fromShelf' in state) || state.fromShelf !== true || !('shelfId' in state)) return undefined;
  return typeof state.shelfId === 'number' && Number.isInteger(state.shelfId) && state.shelfId > 0 ? state.shelfId : undefined;
}

function getTitleOriginShelfPath(state: unknown): string | undefined {
  const shelfId = getTitleOriginShelfId(state);
  return shelfId === undefined ? undefined : `/shelves/${shelfId}`;
}

function getTitleOriginShelfScrollPosition(state: unknown): number | undefined {
  if (typeof state !== 'object' || state === null || !('fromShelf' in state) || state.fromShelf !== true || !('shelfScrollY' in state)) return undefined;
  return typeof state.shelfScrollY === 'number' && Number.isFinite(state.shelfScrollY) && state.shelfScrollY >= 0 ? state.shelfScrollY : undefined;
}

export function getLibraryRestoreScrollPosition(state: unknown): number | undefined {
  if (typeof state !== 'object' || state === null || !('restoreLibraryScrollY' in state)) return undefined;
  return typeof state.restoreLibraryScrollY === 'number' && Number.isFinite(state.restoreLibraryScrollY) && state.restoreLibraryScrollY >= 0 ? state.restoreLibraryScrollY : undefined;
}

export function useBackToLibraryLabel(): string {
  const { state } = useLocation();
  if (getTitleOriginShelfPath(state)) return 'Back to shelf';
  return getTitleOriginPath(state) === '/' ? 'Back to home' : 'Back to library';
}

export function useBackToLibrary(): () => void {
  const navigate = useNavigate();
  const { state } = useLocation();

  return useCallback(() => {
    const shelfPath = getTitleOriginShelfPath(state);
    if (shelfPath) {
      navigate(shelfPath, { state: { restoreShelfScrollY: getTitleOriginShelfScrollPosition(state) }, viewTransition: true });
      return;
    }
    const scrollPosition = getTitleOriginScrollPosition(state);
    if (scrollPosition !== undefined) {
      navigate({ pathname: getTitleOriginPath(state), search: getTitleOriginSearch(state) }, { state: { restoreLibraryScrollY: scrollPosition }, viewTransition: true });
      return;
    }
    navigate(getTitleOriginPath(state), { viewTransition: true });
  }, [navigate, state]);
}
