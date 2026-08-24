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

function getTitleOriginShelfPath(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null || !('fromShelf' in state) || state.fromShelf !== true || !('shelfId' in state)) return undefined;
  return typeof state.shelfId === 'number' && Number.isInteger(state.shelfId) && state.shelfId > 0 ? `/shelves/${state.shelfId}` : undefined;
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
  return getTitleOriginShelfPath(state) ? 'Back to shelf' : 'Back to library';
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
      navigate({ pathname: '/', search: getTitleOriginSearch(state) }, { state: { restoreLibraryScrollY: scrollPosition }, viewTransition: true });
      return;
    }
    navigate('/', { viewTransition: true });
  }, [navigate, state]);
}
