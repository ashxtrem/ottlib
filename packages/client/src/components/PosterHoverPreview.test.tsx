import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { previewFacts, qualityChips, TrailerLayer } from './PosterHoverPreview';

const portals = vi.hoisted(() => [] as { node: ReactNode; container: unknown }[]);

vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  createPortal: (node: ReactNode, container: unknown) => { portals.push({ node, container }); return null; }
}));

describe('TrailerLayer', () => {
  it('renders the trailer dialog in the container, not inside the card row', () => {
    const body = {} as Element;
    const row = renderToStaticMarkup(<ul><li><article>card</article><TrailerLayer trailerKey="abc" title="Arrival" open onClose={vi.fn()} container={body} /></li></ul>);

    expect(row).not.toContain('<dialog');
    expect(row).not.toContain('Close');
    expect(portals).toHaveLength(1);
    expect(portals[0].container).toBe(body);
    const dialog = renderToStaticMarkup(<>{portals[0].node}</>);
    expect(dialog).toContain('<dialog');
    expect(dialog).toContain('Arrival — Trailer');
  });
});

describe('preview facts', () => {
  it('joins the known facts and skips the rest', () => {
    expect(previewFacts(2016, '1h 56m', 7.9)).toBe('2016 · 1h 56m · ★ 7.9');
    expect(previewFacts(null, null, 0)).toBe('');
    expect(qualityChips({ resolution: '4K', hdrFormat: null })).toEqual(['4K']);
  });
});
