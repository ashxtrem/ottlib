import { getDeviceId } from './useDeviceId';

export class ApiError extends Error {
  public constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Fired when the server asks for the access PIN, so the app can show its sign-in screen. */
export const unauthorizedEvent = 'ottlib:unauthorized';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers); headers.set('x-device-id', getDeviceId());
  if (options.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) window.dispatchEvent(new Event(unauthorizedEvent));
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new ApiError(payload.error ?? `Request failed (${response.status})`, response.status); }
  if (response.status === 204) return undefined as T; return response.json() as Promise<T>;
}
