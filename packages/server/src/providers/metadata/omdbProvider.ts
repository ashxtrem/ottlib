import type { EpisodeMetadata, MediaType, MetadataCandidate, MetadataProvider, MovieMetadata } from './MetadataProvider.js';
import { externalRequestTimeoutMs } from '../../config/defaults.js';

export class OmdbProvider implements MetadataProvider {
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
    if (!response.ok) return null; const item = await response.json() as any; if (item.Response === 'False') return null;
    return { providerId, title: item.Title, year: Number.parseInt(item.Year, 10) || null, overview: item.Plot === 'N/A' ? null : item.Plot,
      posterUrl: item.Poster === 'N/A' ? null : item.Poster, backdropUrl: null, genres: item.Genre === 'N/A' ? [] : item.Genre.split(', '),
      cast: item.Actors === 'N/A' ? [] : item.Actors.split(', '), rating: Number.parseFloat(item.imdbRating) || null, runtime: Number.parseInt(item.Runtime, 10) || null,
      imdbId: item.imdbID ?? providerId };
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
    if (!response.ok) return null; const item = await response.json() as any; if (item.Response === 'False') return null;
    return { id: imdbId, title: item.Title, year: Number.parseInt(item.Year, 10) || null, score: 1, mediaType: item.Type === 'series' ? 'tv' : 'movie' };
  }
}
