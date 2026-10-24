import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './apiClient';
import { clearProfileToken, getProfileToken, profileRequiredEvent, setProfileToken } from './profileSession';

vi.mock('./useDeviceId', () => ({ getDeviceId: () => 'device-1' }));

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); }
  };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('api', () => {
  let events: string[];
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    events = [];
    const target = new EventTarget();
    target.addEventListener(profileRequiredEvent, () => events.push(profileRequiredEvent));
    target.addEventListener('ottlib:unauthorized', () => events.push('unauthorized'));
    vi.stubGlobal('window', target);
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    clearProfileToken();
  });
  afterEach(() => vi.unstubAllGlobals());

  const sentHeaders = () => new Headers(fetchMock.mock.calls[0][1]?.headers);

  it('sends the stored profile token as the profile header', async () => {
    localStorage.setItem('ottlib-profile-session', 'token-1');
    fetchMock.mockResolvedValue(json(200, { ok: true }));

    await api('/api/movies');

    expect(sentHeaders().get('x-profile-session')).toBe('token-1');
    expect(sentHeaders().get('x-device-id')).toBe('device-1');
  });

  it('sends no profile header without a token', async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await api('/api/movies');
    expect(sentHeaders().has('x-profile-session')).toBe(false);
  });

  it('clears the token and notifies the gate on 409 PROFILE_REQUIRED', async () => {
    setProfileToken('stale');
    fetchMock.mockResolvedValue(json(409, { error: 'PROFILE_REQUIRED', message: 'Pick a profile to continue.' }));

    const error = await api('/api/movies').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'PROFILE_REQUIRED', message: 'Pick a profile to continue.' });
    expect(getProfileToken()).toBeNull();
    expect(events).toEqual([profileRequiredEvent]);
  });

  it('keeps a token picked while the failing request was in flight', async () => {
    setProfileToken('old');
    fetchMock.mockImplementation(async () => { setProfileToken('new'); return json(409, { error: 'PROFILE_REQUIRED', message: 'Pick a profile.' }); });

    await api('/api/movies').catch(() => undefined);

    expect(getProfileToken()).toBe('new');
    expect(events).toEqual([]);
  });

  it('leaves the token alone for other 409 codes and reads their message', async () => {
    setProfileToken('token-1');
    fetchMock.mockResolvedValue(json(409, { error: 'PROFILE_LIMIT', message: 'A library can have at most 6 profiles.' }));

    await expect(api('/api/profiles', { method: 'POST', body: '{}' })).rejects.toMatchObject({ code: 'PROFILE_LIMIT', message: 'A library can have at most 6 profiles.' });
    expect(getProfileToken()).toBe('token-1');
    expect(events).toEqual([]);
  });

  it('keeps plain `{ error }` bodies as the message, without a code', async () => {
    fetchMock.mockResolvedValue(json(400, { error: 'Invalid request' }));
    await expect(api('/api/x')).rejects.toMatchObject({ status: 400, message: 'Invalid request', code: undefined });
  });

  it('still reports 401 to the access-PIN gate', async () => {
    fetchMock.mockResolvedValue(json(401, { error: 'Sign in first.' }));
    await api('/api/movies').catch(() => undefined);
    expect(events).toEqual(['unauthorized']);
  });
});
