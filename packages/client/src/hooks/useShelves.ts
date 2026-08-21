import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Movie, ShelfDetail, ShelfSummary } from '@ottlib/shared';
import { api } from './apiClient';
import { useToast } from './useToast';

export function useShelves() {
  return useQuery({ queryKey: ['shelves'], queryFn: () => api<ShelfSummary[]>('/api/shelves') });
}

export function useShelf(id: string | undefined) {
  return useQuery({ queryKey: ['shelf', id], enabled: Boolean(id), queryFn: () => api<ShelfDetail>(`/api/shelves/${id}`) });
}

export function useShelfActions() {
  const client = useQueryClient();
  const { show } = useToast();
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['shelves'] });
    client.invalidateQueries({ queryKey: ['shelf'] });
    client.invalidateQueries({ queryKey: ['movies'] });
    client.invalidateQueries({ queryKey: ['movie'] });
  };
  const create = useMutation({
    mutationFn: ({ name, movieIds }: { name: string; movieIds: number[] }) => api<ShelfDetail>('/api/shelves', { method: 'POST', body: JSON.stringify({ name, movieIds }) }),
    onSuccess: (shelf) => { refresh(); show(`${shelf.name} shelf created.`, 'success'); },
    onError: (error) => show(error.message, 'error')
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api<ShelfSummary>(`/api/shelves/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: () => { refresh(); show('Shelf renamed.', 'success'); }, onError: (error) => show(error.message, 'error')
  });
  const removeShelf = useMutation({
    mutationFn: (id: number) => api<void>(`/api/shelves/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); show('Shelf deleted.', 'success'); }, onError: (error) => show(error.message, 'error')
  });
  const addMovies = useMutation({
    mutationFn: ({ id, movieIds }: { id: number; movieIds: number[] }) => api<ShelfDetail>(`/api/shelves/${id}/movies`, { method: 'POST', body: JSON.stringify({ movieIds }) }),
    onSuccess: () => { refresh(); show('Titles added to shelf.', 'success'); }, onError: (error) => show(error.message, 'error')
  });
  const removeMovie = useMutation({
    mutationFn: ({ id, movieId }: { id: number; movieId: number }) => api<ShelfDetail>(`/api/shelves/${id}/movies/${movieId}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); show('Title removed from shelf.', 'success'); }, onError: (error) => show(error.message, 'error')
  });
  const reorder = useMutation({
    mutationFn: ({ id, movieIds }: { id: number; movieIds: number[] }) => api<ShelfDetail>(`/api/shelves/${id}/order`, { method: 'PUT', body: JSON.stringify({ movieIds }) }),
    onSuccess: () => refresh(), onError: (error) => show(error.message, 'error')
  });
  const updateMovieShelves = useMutation({
    mutationFn: ({ movieId, shelfIds, newShelfName }: { movieId: number; shelfIds: number[]; newShelfName?: string }) => api<Movie>(`/api/movies/${movieId}/shelves`, { method: 'PUT', body: JSON.stringify({ shelfIds, newShelfName }) }),
    onSuccess: () => { refresh(); show('Shelf memberships saved.', 'success'); }, onError: (error) => show(error.message, 'error')
  });
  return { create, rename, removeShelf, addMovies, removeMovie, reorder, updateMovieShelves };
}
