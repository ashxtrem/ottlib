import { describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => vi.fn());
vi.mock('./apiClient', async (importOriginal) => ({ ...(await importOriginal<typeof import('./apiClient')>()), api: apiMock }));

import { ApiError } from './apiClient';
import { findHandoffMutationOptions, findHandoffRequest, hashlarkNotFoundMessage, hashlarkOpenedMessage } from './useFindHandoff';

describe('findHandoffRequest', () => {
  it('sends the title, year and IMDb id as fields', () => {
    expect(findHandoffRequest({ title: ' Arrival ', year: 2016, imdbId: 'tt2543164' })).toEqual({ title: 'Arrival', year: 2016, imdbId: 'tt2543164' });
  });

  it('sends nothing to just open the app, and drops values the server would reject', () => {
    expect(findHandoffRequest()).toEqual({});
    expect(findHandoffRequest({ title: 'x'.repeat(250), year: null, imdbId: 'nm123' })).toEqual({ title: 'x'.repeat(200) });
  });
});

describe('findHandoffMutationOptions', () => {
  it('posts the request to the hand-off endpoint and toasts success', async () => {
    const show = vi.fn();
    apiMock.mockResolvedValueOnce({ app: 'hashlark' });
    const options = findHandoffMutationOptions(show);
    await options.mutationFn({ title: 'Arrival', year: 2016 });
    expect(apiMock).toHaveBeenCalledWith('/api/find/handoff', { method: 'POST', body: JSON.stringify({ title: 'Arrival', year: 2016 }) });
    options.onSuccess();
    expect(show).toHaveBeenCalledWith(hashlarkOpenedMessage, 'success');
    expect(hashlarkOpenedMessage).toBe('Opened in Hashlark on the server PC.');
  });

  it('says Hashlark is not installed on HASHLARK_NOT_FOUND, else shows the server error', () => {
    const show = vi.fn();
    const options = findHandoffMutationOptions(show);
    options.onError(new ApiError('Hashlark is not registered', 409, 'HASHLARK_NOT_FOUND'));
    expect(show).toHaveBeenLastCalledWith("Hashlark isn't installed on the server PC.", 'error');
    expect(hashlarkNotFoundMessage).toBe("Hashlark isn't installed on the server PC.");
    options.onError(new ApiError('Find is not set to Hashlark. Choose it in Settings.', 404));
    expect(show).toHaveBeenLastCalledWith('Find is not set to Hashlark. Choose it in Settings.', 'error');
  });
});
