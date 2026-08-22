import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface LibraryViewState { search: string; watched: boolean | undefined; sort: 'title' | 'year' | 'added' | 'quality'; genre: string; actor: string; quality: string; audioLanguage: string; minRating: number | undefined; needsReview: boolean }

const storageKey = 'movie-library-library-view';
export const initialLibraryViewState: LibraryViewState = { search: '', watched: undefined, sort: 'title', genre: '', actor: '', quality: '', audioLanguage: '', minRating: undefined, needsReview: false };

function readState(): LibraryViewState {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return initialLibraryViewState;
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '', watched: typeof parsed.watched === 'boolean' ? parsed.watched : undefined,
      sort: parsed.sort === 'year' || parsed.sort === 'added' || parsed.sort === 'quality' ? parsed.sort : 'title', genre: typeof parsed.genre === 'string' ? parsed.genre : '',
      actor: typeof parsed.actor === 'string' ? parsed.actor : '', quality: typeof parsed.quality === 'string' ? parsed.quality : '', audioLanguage: typeof parsed.audioLanguage === 'string' ? parsed.audioLanguage : '', minRating: typeof parsed.minRating === 'number' && Number.isFinite(parsed.minRating) ? parsed.minRating : undefined,
      needsReview: parsed.needsReview === true
    };
  } catch { return initialLibraryViewState; }
}

function saveState(state: LibraryViewState): void {
  try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Session storage is optional. */ }
}

export function libraryStateFromSearchParams(params: URLSearchParams): LibraryViewState {
  const minRatingValue = params.get('minRating'); const minRating = minRatingValue === null || minRatingValue === '' ? undefined : Number(minRatingValue);
  const sort = params.get('sort'); const watched = params.get('watched');
  return {
    search: params.get('search') ?? '', genre: params.get('genre') ?? '', actor: params.get('actor') ?? '', quality: params.get('quality') ?? '', audioLanguage: params.get('audioLanguage') ?? '',
    watched: watched === 'true' ? true : watched === 'false' ? false : undefined,
    sort: sort === 'year' || sort === 'added' || sort === 'quality' ? sort : 'title',
    minRating: minRating !== undefined && Number.isFinite(minRating) && minRating >= 0 && minRating <= 10 ? minRating : undefined,
    needsReview: params.get('needsReview') === 'true'
  };
}

export function libraryStateToSearchParams(state: LibraryViewState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.search.trim()) params.set('search', state.search.trim()); if (state.genre) params.set('genre', state.genre); if (state.actor) params.set('actor', state.actor); if (state.quality) params.set('quality', state.quality); if (state.audioLanguage) params.set('audioLanguage', state.audioLanguage);
  if (state.watched !== undefined) params.set('watched', String(state.watched)); if (state.sort !== 'title') params.set('sort', state.sort);
  if (state.minRating !== undefined) params.set('minRating', String(state.minRating)); if (state.needsReview) params.set('needsReview', 'true');
  return params;
}

export function useLibraryViewState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [fallbackState, setFallbackState] = useState<LibraryViewState>(readState);
  const hasUrlState = searchParams.size > 0;
  const urlState = libraryStateFromSearchParams(searchParams);
  const state = hasUrlState ? urlState : fallbackState;

  useEffect(() => {
    if (!hasUrlState) return;
    saveState(urlState);
  }, [hasUrlState, urlState.actor, urlState.audioLanguage, urlState.genre, urlState.minRating, urlState.needsReview, urlState.quality, urlState.search, urlState.sort, urlState.watched]);

  const update = (change: Partial<LibraryViewState>) => {
    const next = { ...state, ...change };
    const nextParams = libraryStateToSearchParams(next);
    saveState(next); if (nextParams.size === 0) setFallbackState(next); setSearchParams(nextParams);
  };

  return {
    ...state,
    setSearch: (search: string) => update({ search }),
    setWatched: (watched: boolean | undefined) => update({ watched }),
    setSort: (sort: string) => update({ sort: sort === 'year' || sort === 'added' || sort === 'quality' ? sort : 'title' }),
    setGenre: (genre: string) => update({ genre }),
    setActor: (actor: string) => update({ actor }),
    setQuality: (quality: string) => update({ quality }),
    setAudioLanguage: (audioLanguage: string) => update({ audioLanguage }),
    setMinRating: (minRating: number | undefined) => update({ minRating }),
    setNeedsReview: (needsReview: boolean) => update({ needsReview }),
    clearFilters: () => update(initialLibraryViewState)
  };
}
