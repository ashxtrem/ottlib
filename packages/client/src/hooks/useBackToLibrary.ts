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

export function getLibraryRestoreScrollPosition(state: unknown): number | undefined {
  if (typeof state !== 'object' || state === null || !('restoreLibraryScrollY' in state)) return undefined;
  return typeof state.restoreLibraryScrollY === 'number' && Number.isFinite(state.restoreLibraryScrollY) && state.restoreLibraryScrollY >= 0 ? state.restoreLibraryScrollY : undefined;
}

export function useBackToLibrary(): () => void {
  const navigate = useNavigate();
  const { state } = useLocation();

  return useCallback(() => {
    const scrollPosition = getTitleOriginScrollPosition(state);
    if (scrollPosition !== undefined) {
      navigate({ pathname: '/', search: getTitleOriginSearch(state) }, { state: { restoreLibraryScrollY: scrollPosition } });
      return;
    }
    navigate('/');
  }, [navigate, state]);
}
