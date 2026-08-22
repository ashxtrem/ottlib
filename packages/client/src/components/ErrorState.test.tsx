import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../hooks/apiClient';
import { ErrorState } from './ErrorState';

function render(error?: Error) {
  return renderToStaticMarkup(<MemoryRouter><ErrorState resource="title" error={error} onRetry={vi.fn()} /></MemoryRouter>);
}

describe('ErrorState', () => {
  it('explains when a title was removed from the library', () => {
    const markup = render(new ApiError('Movie not found', 404));
    expect(markup).toContain('This title is no longer in your library');
    expect(markup).toContain('Try again');
    expect(markup).toContain('Back to library');
  });

  it('shows a safe retry message for other failures', () => {
    const markup = render(new ApiError('Internal database details', 500));
    expect(markup).toContain('Couldn&#x27;t reach the server');
    expect(markup).not.toContain('Internal database details');
  });
});
