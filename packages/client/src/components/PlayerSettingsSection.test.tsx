import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PictureDefaultView } from './PictureDefaultRow';
import { PlayerSettingsView } from './PlayerSettingsSection';

describe('PictureDefaultView', () => {
  it('offers the 7 modes with the device default selected', () => {
    const markup = renderToStaticMarkup(<PictureDefaultView value="SmartFill" onChange={() => undefined} />);
    expect(markup).toContain('Default picture mode');
    expect(markup.match(/<option/g)).toHaveLength(7);
    expect(markup).toMatch(/<option[^>]*value="SmartFill"[^>]*selected|<option[^>]*selected[^>]*value="SmartFill"/);
  });

  it('sits in the Player section as an extra row', () => {
    const markup = renderToStaticMarkup(<PlayerSettingsView defaults={{ movie: false, tv: false }} saving={false} onChange={() => undefined}><PictureDefaultView value="Fit" onChange={() => undefined} /></PlayerSettingsView>);
    expect(markup).toContain('id="picture-default"');
  });
});

describe('PlayerSettingsView', () => {
  it('shows the profile defaults per media type, with room for more rows', () => {
    const markup = renderToStaticMarkup(<PlayerSettingsView defaults={{ movie: false, tv: true }} saving={false} onChange={() => undefined}><p>extra row</p></PlayerSettingsView>);
    expect(markup).toContain('Player');
    expect(markup).toMatch(/id="auto-skip-movie"(?![^>]*checked)/);
    expect(markup).toMatch(/id="auto-skip-tv"[^>]*checked/);
    expect(markup).toContain('extra row');
  });

  it('disables the rows while loading', () => {
    const markup = renderToStaticMarkup(<PlayerSettingsView defaults={undefined} saving={false} onChange={() => undefined} />);
    expect(markup.match(/disabled/g)).toHaveLength(2);
  });
});
