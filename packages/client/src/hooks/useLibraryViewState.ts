import { useEffect, useState } from 'react';

interface LibraryViewState { search: string; watched: boolean | undefined; sort: string; genre: string; actor: string; minRating: number | undefined }
const storageKey = 'movie-library-library-view';
const initialState: LibraryViewState = { search: '', watched: undefined, sort: 'title', genre: '', actor: '', minRating: undefined };

function readState(): LibraryViewState {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    if (typeof parsed?.search !== 'string' || typeof parsed?.sort !== 'string') return initialState;
    return { search: parsed.search, sort: parsed.sort, watched: typeof parsed.watched === 'boolean' ? parsed.watched : undefined, genre: typeof parsed.genre === 'string' ? parsed.genre : '', actor: typeof parsed.actor === 'string' ? parsed.actor : '', minRating: typeof parsed.minRating === 'number' ? parsed.minRating : undefined };
  } catch { return initialState; }
}

export function useLibraryViewState() {
  const [state, setState] = useState<LibraryViewState>(readState);
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);
  return {
    ...state,
    setSearch: (search: string) => setState((current) => ({ ...current, search })),
    setWatched: (watched: boolean | undefined) => setState((current) => ({ ...current, watched })),
    setSort: (sort: string) => setState((current) => ({ ...current, sort })),
    setGenre: (genre: string) => setState((current) => ({ ...current, genre })),
    setActor: (actor: string) => setState((current) => ({ ...current, actor })),
    setMinRating: (minRating: number | undefined) => setState((current) => ({ ...current, minRating })),
    clearFilters: () => setState(initialState)
  };
}
