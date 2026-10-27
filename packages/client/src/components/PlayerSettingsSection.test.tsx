import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayerSettingsView } from './PlayerSettingsSection';

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
