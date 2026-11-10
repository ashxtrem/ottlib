import { renderToStaticMarkup } from 'react-dom/server';
import type { TorrentResult } from '@ottlib/shared';
import { describe, expect, it, vi } from 'vitest';
import { TorrentResultRow } from './TorrentResultRow';
import { TorrentResultTable } from './TorrentResultTable';

vi.mock('./TorrentSendButton', () => ({ TorrentSendButton: () => <button type="button">send</button> }));

function result(fileName: string, patch: Partial<TorrentResult> = {}): TorrentResult {
  return { fileName, fileSize: 1_000, fileUrl: `magnet:?${fileName}`, nbSeeders: 5, nbLeechers: 1, siteUrl: null, descrLink: null, engines: [], publishedAt: null, quality: { resolution: null, source: null, codec: null, group: null }, score: null, bestMatch: false, libraryStatus: 'new', ...patch };
}

const scored = [result('few-seeds', { score: 95, bestMatch: true, nbSeeders: 2 }), result('many-seeds', { score: 40, nbSeeders: 80 })];

describe('TorrentResultTable', () => {
  it('sorts by Best match by default when results have scores, with one badge on the top row', () => {
    const markup = renderToStaticMarkup(<TorrentResultTable results={scored} />);
    expect(markup).toMatch(/<option value="best" selected="">Best match<\/option>/);
    expect(markup.match(/Best match<\/span>/g)).toHaveLength(2); // one card, one table row
    expect(markup.indexOf('few-seeds')).toBeLessThan(markup.indexOf('many-seeds'));
  });

  it('stays as before without scores: seeders sort, no Best match option or badge', () => {
    const markup = renderToStaticMarkup(<TorrentResultTable results={[result('few', { nbSeeders: 2 }), result('many', { nbSeeders: 80 })]} />);
    expect(markup).toMatch(/<option value="seeders" selected="">Seeders<\/option>/);
    expect(markup).not.toContain('Best match');
    expect(markup.indexOf('many')).toBeLessThan(markup.indexOf('few'));
  });
});

describe('TorrentResultRow', () => {
  it('shows the Best match badge only on the best match', () => {
    expect(renderToStaticMarkup(<TorrentResultRow result={scored[0]!} />)).toContain('Best match');
    expect(renderToStaticMarkup(<TorrentResultRow result={scored[1]!} />)).not.toContain('Best match');
  });
});
