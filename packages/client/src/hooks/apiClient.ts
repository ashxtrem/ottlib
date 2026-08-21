import { getDeviceId } from './useDeviceId';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers); headers.set('x-device-id', getDeviceId());
  if (options.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error ?? `Request failed (${response.status})`); }
  if (response.status === 204) return undefined as T; return response.json() as Promise<T>;
}
