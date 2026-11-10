import type { MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { saveLibraryScrollPosition } from './useLibraryScrollRestoration';
import { watchPath } from './useUpNext';

function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

/** The link state a title link carries without JS (middle-click, new tab): a shelf scope, or none. */
export function movieLinkState(shelfId?: number): { fromShelf: true; shelfId: number } | undefined {
  return shelfId === undefined ? undefined : { fromShelf: true, shelfId };
}

/**
 * Opening a title from a card or its hover preview: the details link, the router state the details page uses to
 * return (shelf or library with its scroll position), the poster view transition, and the shelf-scoped Play path.
 */
export function useOpenMovie(movieId: number, shelfId?: number) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (shelfId === undefined && pathname === '/library') saveLibraryScrollPosition();
    if (!isPlainClick(event)) return;
    event.preventDefault();
    const link = event.currentTarget;
    link.querySelector('img')?.style.setProperty('view-transition-name', 'poster');
    const state = shelfId !== undefined
      ? { fromShelf: true, shelfId, shelfScrollY: window.scrollY }
      : { fromLibrary: true, libraryPath: pathname, libraryScrollY: window.scrollY, librarySearch: search };
    navigate(`/movie/${movieId}`, { state, viewTransition: true });
    window.setTimeout(() => link.querySelector('img')?.style.removeProperty('view-transition-name'), 500);
  };
  return { to: `/movie/${movieId}`, state: movieLinkState(shelfId), onClick, playTo: watchPath(movieId, shelfId) };
}

export type OpenMovie = ReturnType<typeof useOpenMovie>;
