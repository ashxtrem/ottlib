import { PROFILE_SESSION_HEADER } from '@ottlib/shared';
import { getDeviceId } from './useDeviceId';
import { getProfileToken, reportProfileRequired } from './profileSession';

export class ApiError extends Error {
  /** `code` is set when the server sends a machine-readable code as `error` next to a readable `message`. */
  public constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Fired when the server asks for the access PIN, so the app can show its sign-in screen. */
export const unauthorizedEvent = 'ottlib:unauthorized';

async function toApiError(response: Response): Promise<ApiError> {
  const payload: { error?: unknown; message?: unknown } = await response.json().catch(() => ({}));
  const error = typeof payload.error === 'string' ? payload.error : undefined;
  if (typeof payload.message === 'string') return new ApiError(payload.message, response.status, error);
  return new ApiError(error ?? `Request failed (${response.status})`, response.status);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers); headers.set('x-device-id', getDeviceId());
  const profileToken = getProfileToken(); if (profileToken) headers.set(PROFILE_SESSION_HEADER, profileToken);
  if (options.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) window.dispatchEvent(new Event(unauthorizedEvent));
  if (!response.ok) {
    const error = await toApiError(response);
    if (response.status === 409 && error.code === 'PROFILE_REQUIRED') reportProfileRequired(profileToken);
    throw error;
  }
  if (response.status === 204) return undefined as T; return response.json() as Promise<T>;
}
