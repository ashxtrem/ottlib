import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('./components/PinGate', () => ({ PinGate: ({ children }: { children: ReactNode }) => <div data-gate="pin">{children}</div> }));
vi.mock('./components/ProfileGate', () => ({ ProfileGate: ({ children }: { children: ReactNode }) => <div data-gate="profile">{children}</div> }));
vi.mock('./pages/WatchPage', () => ({ WatchPage: () => <p>watch page</p> }));

describe('App', () => {
  it('renders /watch/:id outside the header layout, inside the PIN and profile gates', () => {
    const markup = renderToStaticMarkup(<MemoryRouter initialEntries={['/watch/7']}><App /></MemoryRouter>);
    expect(markup).toBe('<div data-gate="pin"><div data-gate="profile"><p>watch page</p></div></div>');
  });
});
