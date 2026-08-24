import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { ManualMatchCandidate, MatchCandidate, Movie, MovieFilterOptions, MovieListPage } from '@ottlib/shared';
import { api } from './apiClient';
import { useToast } from './useToast';

export interface MovieFilters { search?: string; watched?: boolean; availability?: 'available' | 'unavailable'; mediaType?: 'movie' | 'tv'; sort?: string; genre?: string; actor?: string; quality?: string; audioLanguage?: string; minRating?: number; needsReview?: boolean }
type MovieListData = InfiniteData<MovieListPage, string | undefined>;

function movieParams(filters: MovieFilters, cursor?: string): URLSearchParams {
  const params = new URLSearchParams(); if (filters.search) params.set('search', filters.search); if (filters.watched !== undefined) params.set('watched', String(filters.watched)); if (filters.availability) params.set('availability', filters.availability); if (filters.mediaType) params.set('mediaType', filters.mediaType); if (filters.sort) params.set('sort', filters.sort); if (filters.genre) params.set('genre', filters.genre); if (filters.actor) params.set('actor', filters.actor); if (filters.quality) params.set('quality', filters.quality); if (filters.audioLanguage) params.set('audioLanguage', filters.audioLanguage); if (filters.minRating !== undefined) params.set('minRating', String(filters.minRating)); if (filters.needsReview) params.set('needsReview', 'true'); if (cursor) params.set('cursor', cursor);
  return params;
}

export function useMovies(filters: MovieFilters = {}) {
  const query = useInfiniteQuery({
    queryKey: ['movies', filters], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => { const params = movieParams(filters, pageParam); return api<MovieListPage>(`/api/movies${params.size ? `?${params}` : ''}`); },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    placeholderData: keepPreviousData
  });
  const data = query.data && { items: query.data.pages.flatMap((page) => page.items), total: query.data.pages[0]?.total ?? 0 };
  return { ...query, data };
}
export function useLibraryTitleCount() { return useQuery({ queryKey: ['library-title-count'], queryFn: async () => (await api<MovieListPage>('/api/movies?limit=1')).total }); }
export function useUnavailableMovieCount() { return useQuery({ queryKey: ['unavailable-movie-count'], queryFn: async () => (await api<MovieListPage>('/api/movies?availability=unavailable&limit=1')).total }); }
export function useSuggestedMovieCount() { return useQuery({ queryKey: ['suggested-movie-count'], queryFn: async () => (await api<MovieListPage>('/api/movies?needsReview=true&limit=1')).total }); }
export function useAvailableSuggestedMovieCount() { return useQuery({ queryKey: ['suggested-movie-count', 'available'], queryFn: async () => (await api<MovieListPage>('/api/movies?availability=available&needsReview=true&limit=1')).total }); }
export function useMovieFilterOptions() { return useQuery({ queryKey: ['movie-filter-options'], queryFn: () => api<MovieFilterOptions>('/api/movies/filter-options') }); }
export function useMovie(id: string | undefined) { return useQuery({ queryKey: ['movie', id], enabled: Boolean(id), queryFn: () => api<Movie>(`/api/movies/${id}`) }); }
export function useMatchCandidates(id: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['movie-candidates', id], enabled: Boolean(id) && enabled, queryFn: () => api<MatchCandidate[]>(`/api/movies/${id}/candidates`) });
}
export function useMovieDuplicates(id: string | undefined) {
  return useQuery({ queryKey: ['movie-duplicates', id], enabled: Boolean(id), queryFn: () => api<Movie[]>(`/api/movies/${id}/duplicates`) });
}
export function useMovieActions() {
  const client = useQueryClient(); const { show } = useToast();
  const refresh = (id?: number) => { client.invalidateQueries({ queryKey: ['movies'] }); client.invalidateQueries({ queryKey: ['movie'] }); client.invalidateQueries({ queryKey: ['movie-duplicates'] }); client.invalidateQueries({ queryKey: ['shelf'] }); client.invalidateQueries({ queryKey: ['movie-filter-options'] }); if (id !== undefined) client.invalidateQueries({ queryKey: ['movie-candidates', String(id)] }); };
  const watch = useMutation({
    mutationFn: ({ id, watched }: { id: number; watched: boolean; silent?: boolean }) => api<Movie>(`/api/movies/${id}/watch-state`, { method: 'PUT', body: JSON.stringify({ watched }) }),
    onMutate: async ({ id, watched }) => {
      await client.cancelQueries({ queryKey: ['movies'] }); await client.cancelQueries({ queryKey: ['movie'] });
      const previousMovieLists = client.getQueriesData<MovieListData>({ queryKey: ['movies'] }); const previousMovies = client.getQueriesData<Movie>({ queryKey: ['movie'] });
      client.setQueriesData<MovieListData>({ queryKey: ['movies'] }, (data) => data && ({ ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map((movie) => movie.id === id ? { ...movie, watched } : movie) })) }));
      client.setQueriesData<Movie>({ queryKey: ['movie'] }, (movie) => movie?.id === id ? { ...movie, watched } : movie);
      return { previousMovieLists, previousMovies };
    },
    onError: (error, _variables, context) => {
      context?.previousMovieLists.forEach(([key, data]) => client.setQueryData(key, data)); context?.previousMovies.forEach(([key, data]) => client.setQueryData(key, data)); show(error.message, 'error');
    },
    onSuccess: (movie, variables) => {
      client.setQueriesData<Movie>({ queryKey: ['movie'] }, (current) => current?.id === movie.id ? movie : current);
      if (!variables.silent) show(variables.watched ? 'Marked as watched.' : 'Marked as unwatched.', 'success', {
        action: { label: 'Undo', onClick: () => watch.mutate({ id: movie.id, watched: !variables.watched, silent: true }) }
      });
    },
    onSettled: () => { void client.invalidateQueries({ queryKey: ['movies'], refetchType: 'active' }); void client.invalidateQueries({ queryKey: ['movie'], refetchType: 'active' }); void client.invalidateQueries({ queryKey: ['shelf'], refetchType: 'active' }); }
  });
  const rematch = useMutation({ mutationFn: ({ id, title }: { id: number; title?: string }) => api<ManualMatchCandidate[]>(`/api/movies/${id}/rematch`, { method: 'POST', body: JSON.stringify({ title }) }), onError: (error) => show(error.message, 'error') });
  const acceptCandidate = useMutation({ mutationFn: ({ id, candidateId, season, episode }: { id: number; candidateId: number; season?: number; episode?: number }) => api(`/api/movies/${id}/candidates/${candidateId}/accept`, { method: 'POST', body: JSON.stringify({ season, episode }) }), onSuccess: (_data, variables) => { refresh(variables.id); show('Match accepted and saved.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const acceptManualCandidate = useMutation({ mutationFn: ({ id, candidate, season, episode }: { id: number; candidate: ManualMatchCandidate; season?: number; episode?: number }) => api(`/api/movies/${id}/manual-candidates/accept`, { method: 'POST', body: JSON.stringify({ candidate: { provider: candidate.provider, providerId: candidate.providerId, mediaType: candidate.mediaType, season: candidate.season, episode: candidate.episode }, season, episode }) }), onSuccess: (_data, variables) => { refresh(variables.id); show('Match accepted and saved.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const rejectCandidates = useMutation({ mutationFn: (id: number) => api(`/api/movies/${id}/candidates/reject`, { method: 'POST' }), onSuccess: (_data, id) => { refresh(id); show('Suggestions dismissed.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const lookupImdb = useMutation({ mutationFn: ({ id, imdbId }: { id: number; imdbId: string }) => api(`/api/movies/${id}/candidates/from-imdb`, { method: 'POST', body: JSON.stringify({ imdbId }) }), onSuccess: (_data, variables) => { refresh(variables.id); show('Found it — review and accept below.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const titleOverride = useMutation({ mutationFn: ({ id, titleOverride }: { id: number; titleOverride: string | null }) => api(`/api/movies/${id}`, { method: 'PATCH', body: JSON.stringify({ titleOverride }) }), onSuccess: () => { refresh(); show('Title override saved.', 'success'); }, onError: (error) => show(error.message, 'error') });
  return { watch, rematch, titleOverride, acceptCandidate, acceptManualCandidate, rejectCandidates, lookupImdb };
}
