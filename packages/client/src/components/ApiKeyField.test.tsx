import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiKeyField } from './ApiKeyField';

describe('ApiKeyField', () => {
  it('renders a saved key as static masked text instead of a submitted input', () => {
    const markup = renderToStaticMarkup(<ApiKeyField id="tmdb-api-key" name="tmdbApiKey" label="TMDb API key" maskedValue="••••1234" />);

    expect(markup).toContain('••••1234');
    expect(markup).toContain('Replace key');
    expect(markup).not.toContain('name="tmdbApiKey"');
  });

  it('keeps an unset key out of the form until the user chooses to add it', () => {
    const markup = renderToStaticMarkup(<ApiKeyField id="tmdb-api-key" name="tmdbApiKey" label="TMDb API key" maskedValue="" />);

    expect(markup).toContain('No key added');
    expect(markup).toContain('Add key');
    expect(markup).not.toContain('name="tmdbApiKey"');
  });
});
