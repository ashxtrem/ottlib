import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/useSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useSettings')>();
  return { ...actual, useSettings: () => ({ data: undefined, error: new Error('Network down'), isFetching: false, refetch: vi.fn() }) };
});

vi.mock('../hooks/useTheme', () => ({ useTheme: () => ({ preference: 'system', setPreference: vi.fn() }) }));
vi.mock('../hooks/useIsLocalClient', () => ({ useIsLocalClient: () => false }));

import { ToastProvider } from '../components/ToastProvider';
import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  it('shows an error state, not a skeleton, when the settings fail to load', () => {
    const markup = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><ToastProvider><MemoryRouter><SettingsPage /></MemoryRouter></ToastProvider></QueryClientProvider>);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Try again');
    expect(markup).not.toContain('Still loading');
  });
});
