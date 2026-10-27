import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PictureMenu } from './PictureMenu';

describe('PictureMenu', () => {
  it('renders the 7 modes as radio items, the current one checked', () => {
    const markup = renderToStaticMarkup(<PictureMenu open mode="Zoom" onSelect={() => undefined} onOpenChange={() => undefined} buttonClassName="" />);
    expect(markup).toContain('aria-label="Picture"');
    expect(markup.match(/role="menuitemradio"/g)).toHaveLength(7);
    expect(markup.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(markup).toContain('Smart fill');
  });

  it('is closed until opened', () => {
    const markup = renderToStaticMarkup(<PictureMenu open={false} mode="Fit" onSelect={() => undefined} onOpenChange={() => undefined} buttonClassName="" />);
    expect(markup).not.toContain('role="menu"');
  });
});
