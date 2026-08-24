import { describe, expect, it, vi } from 'vitest';
import { QbittorrentError } from '../providers/torrent/qbittorrentClient.js';
import { TorrentSearchService } from './torrentSearchService.js';

function searchDouble() {
  return {
    start: vi.fn(), status: vi.fn(), results: vi.fn(), stop: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined)
  };
}

describe('TorrentSearchService', () => {
  it('pages, deduplicates, annotates, sorts, and releases a stopped search', async () => {
    const search = searchDouble();
    search.start.mockResolvedValue('42'); search.status.mockResolvedValue({ id: '42', status: 'Stopped', total: 3 });
    search.results.mockResolvedValueOnce({ total: 3, results: [
      { fileName: 'Owned.Movie.2020.1080p.WEB-DL.x264-ONE', fileUrl: 'magnet:?xt=urn:btih:ABC&dn=one', nbSeeders: 3, engineName: 'One' },
      { fileName: 'Owned.Movie.2020.1080p.WEB-DL.x264-TWO', fileUrl: 'magnet:?dn=two&xt=urn:btih:abc', nbSeeders: 10, engineName: 'Two' }
    ] }).mockResolvedValueOnce({ total: 3, results: [{ fileName: 'Missing.Movie.2021.720p.BluRay.x265', fileUrl: 'magnet:?xt=urn:btih:missing', nbSeeders: 0, engineName: 'Three' }] });
    const movies = { findForTorrentMatch: vi.fn((title: string) => title === 'Owned Movie' ? { id: 1, missing: false } : title === 'Missing Movie' ? { id: 2, missing: true } : undefined) };
    const service = new TorrentSearchService(search as never, movies as never, () => true);
    await expect(service.start('Owned Movie', 2020)).resolves.toEqual({ searchId: '42', status: 'running' });
    const state = await service.status('42');
    expect(search.results).toHaveBeenCalledTimes(2);
    expect(search.delete).toHaveBeenCalledWith('42');
    expect(state.status).toBe('stopped');
    expect(state.results).toHaveLength(2);
    expect(state.results[0]).toMatchObject({ nbSeeders: 10, engines: ['One', 'Two'], libraryStatus: 'owned' });
    expect(state.results[1]).toMatchObject({ libraryStatus: 'missing', nbSeeders: 0 });
  });

  it('reaps only its oldest active search before retrying one 409 start', async () => {
    const search = searchDouble();
    search.start.mockResolvedValueOnce('old').mockRejectedValueOnce(new QbittorrentError('full', 'request-failed', 409)).mockResolvedValueOnce('new');
    const service = new TorrentSearchService(search as never, { findForTorrentMatch: vi.fn() } as never, () => true);
    await service.start('First');
    await expect(service.start('Second')).resolves.toEqual({ searchId: 'new', status: 'running' });
    expect(search.stop).toHaveBeenCalledWith('old');
    expect(search.delete).toHaveBeenCalledWith('old');
    expect(search.start).toHaveBeenCalledTimes(3);
  });

  it('returns an explicit not-configured state without starting a remote search', async () => {
    const search = searchDouble(); const service = new TorrentSearchService(search as never, { findForTorrentMatch: vi.fn() } as never, () => false);
    await expect(service.start('Inception')).resolves.toEqual({ status: 'not-configured' });
    expect(search.start).not.toHaveBeenCalled();
  });
});
