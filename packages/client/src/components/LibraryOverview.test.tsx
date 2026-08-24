import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LibraryOverview } from './LibraryOverview';

describe('LibraryOverview', () => {
  it('groups library totals, unavailable files, and accepted matches', () => {
    const markup = renderToStaticMarkup(<LibraryOverview titleCount={801} unavailableCount={149} matchingTitleCount={652} acceptedMatchCount={121} />);

    expect(markup).toContain('801 titles');
    expect(markup).toContain('149 unavailable titles');
    expect(markup).toContain('Showing 652 matching titles');
    expect(markup).toContain('121 matches accepted');
    expect(markup).not.toContain('Last bulk update');
  });

  it('does not render until at least one count is available', () => {
    expect(renderToStaticMarkup(<LibraryOverview titleCount={undefined} unavailableCount={undefined} matchingTitleCount={undefined} acceptedMatchCount={undefined} />)).toBe('');
  });
});
