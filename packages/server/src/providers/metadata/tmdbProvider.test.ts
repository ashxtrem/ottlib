import { afterEach, describe, expect, it, vi } from 'vitest';
import { TmdbProvider } from './tmdbProvider.js';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function movieDetails() {
  const cast = Array.from({ length: 11 }, (_, index) => ({ name: `Actor ${index}`, profile_path: index === 1 ? null : `/p${index}.jpg` }));
  return {
    id: 603, title: 'The Matrix', release_date: '1999-03-31', overview: 'Neo.', poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg', genres: [{ name: 'Action' }], vote_average: 8.2, runtime: 136,
    credits: { cast }, external_ids: { imdb_id: 'tt0133093' },
    belongs_to_collection: { id: 2344, name: 'The Matrix Collection' },
    images: { logos: [
      { file_path: '/fr.png', iso_639_1: 'fr', vote_average: 9 },
      { file_path: '/plain.png', iso_639_1: null, vote_average: 8 },
      { file_path: '/en-svg.svg', iso_639_1: 'en', vote_average: 9 },
      { file_path: '/en-low.png', iso_639_1: 'en', vote_average: 3 },
      { file_path: '/en-top.png', iso_639_1: 'en', vote_average: 6 }
    ] },
    videos: { results: [
      { site: 'Vimeo', type: 'Trailer', key: 'vimeo', official: true },
      { site: 'YouTube', type: 'Teaser', key: 'teaser', official: true },
      { site: 'YouTube', type: 'Trailer', key: 'fan', official: false },
      { site: 'YouTube', type: 'Trailer', key: 'official', official: true }
    ] }
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('TmdbProvider extras', () => {
  it('asks for images and videos and maps cast photos, logo, collection and trailer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(movieDetails()));
    vi.stubGlobal('fetch', fetchMock);
    const details = await new TmdbProvider('key').getDetails('603', 'movie');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('append_to_response')).toBe('credits,external_ids,images,videos');
    expect(url.searchParams.get('include_image_language')).toBe('en,null');
    expect(details?.castMembers).toHaveLength(8);
    expect(details?.castMembers?.[0]).toEqual({ name: 'Actor 0', photoUrl: 'https://image.tmdb.org/t/p/w185/p0.jpg' });
    expect(details?.castMembers?.map((member) => member.name)).not.toContain('Actor 1');
    expect(details?.cast).toHaveLength(11);
    expect(details?.logoUrl).toBe('https://image.tmdb.org/t/p/w500/en-top.png');
    expect(details?.collection).toEqual({ id: 2344, name: 'The Matrix Collection' });
    expect(details?.trailerKey).toBe('official');
  });

  it('falls back to a language-less logo, an unofficial trailer, then a teaser', async () => {
    const base = movieDetails();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ...base, belongs_to_collection: null, images: { logos: [{ file_path: '/plain.png', iso_639_1: null }] }, videos: { results: [{ site: 'YouTube', type: 'Trailer', key: 'fan', official: false }] } }))
      .mockResolvedValueOnce(jsonResponse({ ...base, images: { logos: [] }, videos: { results: [{ site: 'YouTube', type: 'Teaser', key: 'teaser', official: false }] } }))
      .mockResolvedValueOnce(jsonResponse({ ...base, images: undefined, videos: undefined, credits: undefined }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new TmdbProvider('key');
    const first = await provider.getDetails('1', 'movie');
    expect(first).toEqual(expect.objectContaining({ logoUrl: 'https://image.tmdb.org/t/p/w500/plain.png', trailerKey: 'fan', collection: null }));
    expect(await provider.getDetails('2', 'movie')).toEqual(expect.objectContaining({ logoUrl: null, trailerKey: 'teaser' }));
    expect(await provider.getDetails('3', 'movie')).toEqual(expect.objectContaining({ logoUrl: null, trailerKey: null, castMembers: [] }));
  });

  it('reads a collection with its parts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 2344, name: 'The Matrix Collection', parts: [
      { id: 603, title: 'The Matrix', release_date: '1999-03-31', poster_path: '/m1.jpg' },
      { id: 604, title: 'The Matrix Reloaded', release_date: '', poster_path: null }
    ] }));
    vi.stubGlobal('fetch', fetchMock);
    const collection = await new TmdbProvider('key').getCollection(2344);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/3/collection/2344?');
    expect(collection).toEqual({ id: 2344, name: 'The Matrix Collection', parts: [
      { id: '603', title: 'The Matrix', year: 1999, posterUrl: 'https://image.tmdb.org/t/p/w500/m1.jpg' },
      { id: '604', title: 'The Matrix Reloaded', year: null, posterUrl: null }
    ] });
  });

  it('answers null for a missing collection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 404)));
    await expect(new TmdbProvider('key').getCollection(1)).resolves.toBeNull();
  });
});
