import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TitleHeading } from './TitleHeading';

describe('TitleHeading', () => {
  it('shows the logo in place of the title text and keeps the h1 for screen readers', () => {
    const markup = renderToStaticMarkup(<TitleHeading title="Arrival" year={2016} logoUrl="/media/logos/arrival.png" />);

    expect(markup).toMatch(/<h1[^>]*><span class="sr-only">Arrival \(2016\)<\/span><img src="\/media\/logos\/arrival.png" alt="" aria-hidden="true"/);
  });

  it('shows the plain title without a logo', () => {
    const markup = renderToStaticMarkup(<TitleHeading title="Arrival" year={2016} logoUrl={null} />);

    expect(markup).toMatch(/^<h1/);
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('sr-only');
    expect(markup).toContain('Arrival');
  });
});
