import { useQuery } from '@tanstack/react-query';
import type { MovieCollection } from '@ottlib/shared';
import { api, ApiError } from './apiClient';

/** The collection a title belongs to, or null when it is not part of one (the server answers 404). */
export function useCollection(movieId: string | undefined) {
  return useQuery({
    queryKey: ['movie-collection', movieId],
    enabled: Boolean(movieId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MovieCollection | null> => {
      try { return await api<MovieCollection>(`/api/movies/${movieId}/collection`); } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    }
  });
}
