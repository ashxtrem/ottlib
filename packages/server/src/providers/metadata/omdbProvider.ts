import type { OutsideRating } from '@ottlib/shared';
import type { EpisodeMetadata, MediaType, MetadataCandidate, MetadataProvider, MovieMetadata } from './MetadataProvider.js';
import { RatingsLimitReachedError, type RatingsProvider } from './RatingsProvider.js';
import { externalRequestTimeoutMs } from '../../config/defaults.js';

const ratingSources: Record<string, OutsideRating['source']> = { 'Internet Movie Database': 'imdb', 'Rotten Tomatoes': 'rottenTomatoes', Metacritic: 'metacritic' };

/** OMDb writes ratings as "8.8/10", "87%" or "74/100". */
export function parseOmdbRating(entry: { Source?: string; Value?: string }): OutsideRating | null {
  const source = entry.Source ? ratingSources[entry.Source] : undefined; if (!source || !entry.Value) return null;
  const percent = entry.Value.match(/^\s*(\d+(?:\.\d+)?)\s*%\s*$/);
  if (percent) return { source, value: Number(percent[1]), max: 100 };
  const fraction = entry.Value.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
  if (fraction && Number(fraction[2]) > 0) return { source, value: Number(fraction[1]), max: Number(fraction[2]) };
  return null;
}

export class OmdbProvider implements MetadataProvider, RatingsProvider {
  public readonly name = 'omdb';
  public constructor(private readonly apiKey: string) {}

  public async searchCandidates(title: string, year?: number): Promise<MetadataCandidate[]> {
    const [movie, series] = await Promise.all([this.searchByType(title, year, 'movie'), this.searchByType(title, year, 'tv')]);
    return [...(movie ? [movie] : []), ...(series ? [series] : [])];
  }

  private async searchByType(title: string, year: number | undefined, mediaType: MediaType): Promise<MetadataCandidate | null> {
    const params = new URLSearchParams({ apikey: this.apiKey, t: title, type: mediaType === 'movie' ? 'movie' : 'series' }); if (year) params.set('y', String(year));
    const response = await fetch(`https://www.omdbapi.com/?${params}`, { signal: AbortSignal.timeout(externalRequestTimeoutMs) }); if (!response.ok) throw new Error(`OMDb search failed (${response.status})`);
    const item = await response.json() as any; if (item.Response === 'False') return null;
    return { id: item.imdbID, title: item.Title, year: Number.parseInt(item.Year, 10) || null, score: item.Title.toLowerCase() === title.toLowerCase() ? 0.85 : 0.72, mediaType };
  }

  public async getDetails(providerId: string): Promise<MovieMetadata | null> {
    const response = await fetch(`https://www.omdbapi.com/?${new URLSearchParams({ apikey: this.apiKey, i: providerId, plot: 'full' })}`, { signal: AbortSignal.timeout(externalRequestTimeoutMs) });
    const item = await response.json() as any;
    if (!response.ok || item.Response === 'False') throw new Error(`OMDb metadata lookup failed (${response.status}): ${item.Error ?? 'Unknown provider error'}`);
    return { providerId, title: item.Title, year: Number.parseInt(item.Year, 10) || null, overview: item.Plot === 'N/A' ? null : item.Plot,
      posterUrl: item.Poster === 'N/A' ? null : item.Poster, backdropUrl: null, genres: item.Genre === 'N/A' ? [] : item.Genre.split(', '),
      cast: item.Actors === 'N/A' ? [] : item.Actors.split(', '), rating: Number.parseFloat(item.imdbRating) || null, runtime: Number.parseInt(item.Runtime, 10) || null,
      imdbId: item.imdbID ?? providerId };
  }

  public async getRatings(imdbId: string): Promise<OutsideRating[]> {
    const response = await fetch(`https://www.omdbapi.com/?${new URLSearchParams({ apikey: this.apiKey, i: imdbId })}`, { signal: AbortSignal.timeout(externalRequestTimeoutMs) });
    const item = await response.json().catch(() => ({})) as any;
    if (typeof item.Error === 'string' && /request limit reached/i.test(item.Error)) throw new RatingsLimitReachedError('OMDb', item.Error);
    if (!response.ok || item.Response === 'False') throw new Error(`OMDb ratings lookup failed (${response.status}): ${item.Error ?? 'Unknown provider error'}`);
    return (Array.isArray(item.Ratings) ? item.Ratings : []).map(parseOmdbRating).filter((rating: OutsideRating | null): rating is OutsideRating => rating !== null);
  }

  public async getEpisodeDetails(providerId: string, season: number, episode: number): Promise<EpisodeMetadata | null> {
    const listResponse = await fetch(`https://www.omdbapi.com/?${new URLSearchParams({ apikey: this.apiKey, i: providerId, Season: String(season) })}`, { signal: AbortSignal.timeout(externalRequestTimeoutMs) });
    if (!listResponse.ok) return null; const list = await listResponse.json() as any; if (list.Response === 'False') return null;
    const entry = (list.Episodes ?? []).find((ep: any) => Number(ep.Episode) === episode); if (!entry) return null;
    const detail = await this.getDetails(entry.imdbID);
    return { title: detail?.title ?? entry.Title ?? null, overview: detail?.overview ?? null, stillUrl: detail?.posterUrl ?? null, rating: Number.parseFloat(entry.imdbRating) || null };
  }

  public async getByImdbId(imdbId: string): Promise<MetadataCandidate | null> {
    const response = await fetch(`https://www.omdbapi.com/?${new URLSearchParams({ apikey: this.apiKey, i: imdbId })}`, { signal: AbortSignal.timeout(externalRequestTimeoutMs) });
    const item = await response.json() as any;
    if (!response.ok || item.Response === 'False') throw new Error(`OMDb IMDb lookup failed (${response.status}): ${item.Error ?? 'Unknown provider error'}`);
    if (item.Type === 'episode' && item.seriesID && item.Season && item.Episode) {
      const show = await this.getDetails(item.seriesID);
      if (show) return { id: item.seriesID, title: show.title, year: show.year, score: 1, mediaType: 'tv', season: Number(item.Season), episode: Number(item.Episode) };
    }
    return { id: imdbId, title: item.Title, year: Number.parseInt(item.Year, 10) || null, score: 1, mediaType: item.Type === 'series' ? 'tv' : 'movie' };
  }
}
