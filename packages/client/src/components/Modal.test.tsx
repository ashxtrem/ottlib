import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('labels the native dialog with its rendered heading', () => {
    const markup = renderToStaticMarkup(<Modal open title="Review match" onClose={vi.fn()}><p>Details</p></Modal>);
    const titleId = markup.match(/<h2 id="([^"]+)"/)?.[1];
    const dialogTag = markup.match(/<dialog[^>]+>/)?.[0];

    expect(markup).toContain('<dialog');
    expect(titleId).toBeDefined();
    expect(markup).toContain(`aria-labelledby="${titleId}"`);
    expect(dialogTag).not.toContain('aria-label=');
  });
});
