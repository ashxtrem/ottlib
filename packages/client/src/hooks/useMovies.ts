import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MatchCandidate, Movie, MovieFilterOptions } from '@ottlib/shared';
import { api } from './apiClient';
import { useToast } from './useToast';

export function useMovies(filters: { search?: string; watched?: boolean; sort?: string; genre?: string; actor?: string; minRating?: number } = {}) {
  const params = new URLSearchParams(); if (filters.search) params.set('search', filters.search); if (filters.watched !== undefined) params.set('watched', String(filters.watched)); if (filters.sort) params.set('sort', filters.sort); if (filters.genre) params.set('genre', filters.genre); if (filters.actor) params.set('actor', filters.actor); if (filters.minRating !== undefined) params.set('minRating', String(filters.minRating));
  return useQuery({ queryKey: ['movies', filters], queryFn: () => api<Movie[]>(`/api/movies${params.size ? `?${params}` : ''}`) });
}
export function useMovieFilterOptions() { return useQuery({ queryKey: ['movie-filter-options'], queryFn: () => api<MovieFilterOptions>('/api/movies/filter-options') }); }
export function useMovie(id: string | undefined) { return useQuery({ queryKey: ['movie', id], enabled: Boolean(id), queryFn: () => api<Movie>(`/api/movies/${id}`) }); }
export function useMatchCandidates(id: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['movie-candidates', id], enabled: Boolean(id) && enabled, queryFn: () => api<MatchCandidate[]>(`/api/movies/${id}/candidates`) });
}
export function useMovieActions() {
  const client = useQueryClient(); const { show } = useToast();
  const refresh = (id?: number) => { client.invalidateQueries({ queryKey: ['movies'] }); client.invalidateQueries({ queryKey: ['movie'] }); client.invalidateQueries({ queryKey: ['movie-filter-options'] }); if (id !== undefined) client.invalidateQueries({ queryKey: ['movie-candidates', String(id)] }); };
  const watch = useMutation({ mutationFn: ({ id, watched }: { id: number; watched: boolean }) => api(`/api/movies/${id}/watch-state`, { method: 'PUT', body: JSON.stringify({ watched }) }), onSuccess: (_data, variables) => { refresh(); show(variables.watched ? 'Marked as watched.' : 'Marked as unwatched.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const rematch = useMutation({ mutationFn: ({ id, title }: { id: number; title?: string }) => api<Movie>(`/api/movies/${id}/rematch`, { method: 'POST', body: JSON.stringify({ title }) }), onSuccess: (data, variables) => {
    refresh(variables.id);
    if (data.metadataStatus === 'suggested') show('Found suggestions — pick one below.', 'success');
    else if (data.metadataStatus === 'error') show('Metadata lookup failed — check your API keys and try again.', 'error');
    else show('No matches found. Try "Fetch from IMDb" or adjust the title.', 'info');
  }, onError: (error) => show(error.message, 'error') });
  const acceptCandidate = useMutation({ mutationFn: ({ id, candidateId, season, episode }: { id: number; candidateId: number; season?: number; episode?: number }) => api(`/api/movies/${id}/candidates/${candidateId}/accept`, { method: 'POST', body: JSON.stringify({ season, episode }) }), onSuccess: (_data, variables) => { refresh(variables.id); show('Match accepted and saved.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const rejectCandidates = useMutation({ mutationFn: (id: number) => api(`/api/movies/${id}/candidates/reject`, { method: 'POST' }), onSuccess: (_data, id) => { refresh(id); show('Suggestions dismissed.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const lookupImdb = useMutation({ mutationFn: ({ id, imdbId }: { id: number; imdbId: string }) => api(`/api/movies/${id}/candidates/from-imdb`, { method: 'POST', body: JSON.stringify({ imdbId }) }), onSuccess: (_data, variables) => { refresh(variables.id); show('Found it — review and accept below.', 'success'); }, onError: (error) => show(error.message, 'error') });
  const titleOverride = useMutation({ mutationFn: ({ id, titleOverride }: { id: number; titleOverride: string | null }) => api(`/api/movies/${id}`, { method: 'PATCH', body: JSON.stringify({ titleOverride }) }), onSuccess: () => { refresh(); show('Title override saved.', 'success'); }, onError: (error) => show(error.message, 'error') });
  return { watch, rematch, titleOverride, acceptCandidate, rejectCandidates, lookupImdb };
}
