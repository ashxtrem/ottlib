import { useMutation } from '@tanstack/react-query';
import { findHandoffRequestSchema, type FindHandoffRequest, type FindHandoffResult } from '@ottlib/shared';
import type { ToastApi } from '../components/ToastProvider';
import { api, ApiError } from './apiClient';
import { useToast } from './useToast';

export const hashlarkOpenedMessage = 'Opened in Hashlark on the server PC.';
export const hashlarkNotFoundMessage = "Hashlark isn't installed on the server PC.";

export interface FindQuery { title: string; year?: number | null; imdbId?: string | null }

/** The hand-off body: fields only (the server builds the link). Drops values the server would reject rather than failing the request. */
export function findHandoffRequest(query?: FindQuery): FindHandoffRequest {
  if (!query) return {};
  const title = query.title.trim().slice(0, 200);
  const request: FindHandoffRequest = {};
  if (title) request.title = title;
  if (query.year) request.year = query.year;
  if (query.imdbId && findHandoffRequestSchema.shape.imdbId.safeParse(query.imdbId).success) request.imdbId = query.imdbId;
  return request;
}

export function findHandoffErrorMessage(error: Error): string {
  return error instanceof ApiError && error.code === 'HASHLARK_NOT_FOUND' ? hashlarkNotFoundMessage : error.message;
}

export function findHandoffMutationOptions(show: ToastApi['show']) {
  return {
    mutationFn: (request: FindHandoffRequest) => api<FindHandoffResult>('/api/find/handoff', { method: 'POST', body: JSON.stringify(request) }),
    onSuccess: () => show(hashlarkOpenedMessage, 'success'),
    onError: (error: Error) => show(findHandoffErrorMessage(error), 'error')
  };
}

/** Hands a title (or nothing, to just open the app) to Hashlark on the server PC and toasts the outcome. */
export function useFindHandoff() {
  const { show } = useToast();
  return useMutation(findHandoffMutationOptions(show));
}
