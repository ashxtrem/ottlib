import { afterEach, describe, expect, it, vi } from 'vitest';
import { OmdbProvider, parseOmdbRating } from './omdbProvider.js';
import { RatingsLimitReachedError } from './RatingsProvider.js';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('OMDb ratings', () => {
  it('parses each rating form to a value and a max', () => {
    expect(parseOmdbRating({ Source: 'Internet Movie Database', Value: '8.8/10' })).toEqual({ source: 'imdb', value: 8.8, max: 10 });
    expect(parseOmdbRating({ Source: 'Rotten Tomatoes', Value: '87%' })).toEqual({ source: 'rottenTomatoes', value: 87, max: 100 });
    expect(parseOmdbRating({ Source: 'Metacritic', Value: '74/100' })).toEqual({ source: 'metacritic', value: 74, max: 100 });
    expect(parseOmdbRating({ Source: 'Metacritic', Value: 'N/A' })).toBeNull();
    expect(parseOmdbRating({ Source: 'Other', Value: '5/10' })).toBeNull();
  });

  it('asks by IMDb id and returns the parsed ratings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ Response: 'True', Ratings: [
      { Source: 'Internet Movie Database', Value: '8.8/10' }, { Source: 'Rotten Tomatoes', Value: '87%' }, { Source: 'Metacritic', Value: '74/100' }
    ] }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new OmdbProvider('key').getRatings('tt1375666')).resolves.toEqual([
      { source: 'imdb', value: 8.8, max: 10 }, { source: 'rottenTomatoes', value: 87, max: 100 }, { source: 'metacritic', value: 74, max: 100 }
    ]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('i')).toBe('tt1375666');
    expect(url.searchParams.get('apikey')).toBe('key');
  });

  it('throws a distinguishable error when the request limit is reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ Response: 'False', Error: 'Request limit reached!' }, 401)));
    const error = await new OmdbProvider('key').getRatings('tt1').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RatingsLimitReachedError);
    expect((error as Error).message).toContain('Request limit reached');
  });

  it('throws a plain error for other failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ Response: 'False', Error: 'Incorrect IMDb ID.' })));
    const error = await new OmdbProvider('key').getRatings('tt1').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(RatingsLimitReachedError);
  });
});
