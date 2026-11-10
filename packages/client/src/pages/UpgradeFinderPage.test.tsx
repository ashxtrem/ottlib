import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { UpgradeCandidate } from '@ottlib/shared';
import { describe, expect, it } from 'vitest';
import { findBetterPath, UpgradeFinderView } from './UpgradeFinderPage';

const movie = { id: 7, title: 'Heat & Dust', year: 1983, posterUrl: null, resolution: '720p', hdrFormat: null, showKey: null, watched: false, resumePositionMs: null, durationMs: null, missing: false, metadataStatus: 'matched', shelves: [], fresh: null } as unknown as UpgradeCandidate['movie'];
const render = (props: Parameters<typeof UpgradeFinderView>[0]) => renderToStaticMarkup(<MemoryRouter><UpgradeFinderView {...props} /></MemoryRouter>);

describe('UpgradeFinderView', () => {
  it('lists candidates with their reason and a Find better link', () => {
    const markup = render({ candidates: [{ movie, reason: 'resolution' }, { movie: { ...movie, id: 8, title: 'Old', year: null }, reason: 'codec' }], preferredResolution: '1080p' });
    expect(markup).toContain('Heat &amp; Dust (1983)');
    expect(markup).toContain('Below your preferred 1080p');
    expect(markup).toContain('Old video codec');
    expect(markup).toContain('href="/torrents?q=Heat+%26+Dust&amp;year=1983"');
    expect(markup).toContain('href="/torrents?q=Old"');
    expect(markup.match(/Find better/g)).toHaveLength(2);
    expect(markup).not.toContain('No preferred resolution');
  });

  it('explains that only old-codec titles are listed without a preferred resolution', () => {
    expect(render({ candidates: [], preferredResolution: null })).toContain('only titles in an old video codec are listed');
  });

  it('says so when there is nothing to upgrade', () => {
    expect(render({ candidates: [], preferredResolution: '1080p' })).toContain('Nothing to upgrade');
  });
});

describe('findBetterPath', () => {
  it('leaves the year out when unknown', () => {
    expect(findBetterPath({ title: 'Up', year: null })).toBe('/torrents?q=Up');
  });
});
