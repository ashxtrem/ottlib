import type { EpisodeMetadata, MediaType, MetadataCandidate, MetadataProvider, MovieMetadata } from './MetadataProvider.js';
import { externalRequestTimeoutMs } from '../../config/defaults.js';

export class TmdbProvider implements MetadataProvider {
  public readonly name = 'tmdb';
  public constructor(private readonly apiKey: string) {}

  public async searchCandidates(title: string, year?: number, limit = 5): Promise<MetadataCandidate[]> {
    const [movies, shows] = await Promise.all([this.searchByType(title, year, 'movie'), this.searchByType(title, year, 'tv')]);
    return [...movies, ...shows].sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async searchByType(title: string, year: number | undefined, mediaType: MediaType): Promise<MetadataCandidate[]> {
    const params = new URLSearchParams({ query: title }); if (!this.isAccessToken()) params.set('api_key', this.apiKey);
    if (year) params.set(mediaType === 'movie' ? 'year' : 'first_air_date_year', String(year));
    const response = await this.request(`https://api.themoviedb.org/3/search/${mediaType}?${params}`); if (!response.ok) throw new Error(`TMDb search failed (${response.status})`);
    const results = (await response.json() as any).results ?? [];
    const normalized = title.toLowerCase();
    return results.map((item: any) => {
      const itemTitle = mediaType === 'movie' ? item.title : item.name;
      const itemYear = (mediaType === 'movie' ? item.release_date : item.first_air_date) ? Number((mediaType === 'movie' ? item.release_date : item.first_air_date).slice(0, 4)) : null;
      const score = (itemTitle?.toLowerCase() === normalized ? 0.75 : itemTitle?.toLowerCase().includes(normalized) ? 0.55 : 0.3) + (year && itemYear === year ? 0.25 : 0);
      return { id: String(item.id), title: itemTitle, year: itemYear, score, mediaType };
    });
  }

  public async getDetails(providerId: string, mediaType: MediaType): Promise<MovieMetadata | null> {
    const params = new URLSearchParams({ append_to_response: 'credits,external_ids' }); if (!this.isAccessToken()) params.set('api_key', this.apiKey);
    const response = await this.request(`https://api.themoviedb.org/3/${mediaType}/${encodeURIComponent(providerId)}?${params}`);
    if (!response.ok) return null; const item = await response.json() as any;
    const releaseDate = mediaType === 'movie' ? item.release_date : item.first_air_date;
    return { providerId, title: mediaType === 'movie' ? item.title : item.name, year: releaseDate ? Number(releaseDate.slice(0, 4)) : null, overview: item.overview || null,
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null, backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
      genres: (item.genres ?? []).map((genre: any) => genre.name), cast: (item.credits?.cast ?? []).slice(0, 12).map((person: any) => person.name), rating: item.vote_average ?? null,
      runtime: mediaType === 'movie' ? (item.runtime ?? null) : (item.episode_run_time?.[0] ?? null), imdbId: item.external_ids?.imdb_id ?? null };
  }

  public async getEpisodeDetails(providerId: string, season: number, episode: number): Promise<EpisodeMetadata | null> {
    const params = new URLSearchParams(); if (!this.isAccessToken()) params.set('api_key', this.apiKey);
    const response = await this.request(`https://api.themoviedb.org/3/tv/${encodeURIComponent(providerId)}/season/${season}/episode/${episode}?${params}`);
    if (!response.ok) return null; const item = await response.json() as any;
    return { title: item.name ?? null, overview: item.overview || null, stillUrl: item.still_path ? `https://image.tmdb.org/t/p/w780${item.still_path}` : null, rating: item.vote_average ?? null };
  }

  public async getByImdbId(imdbId: string): Promise<MetadataCandidate | null> {
    const params = new URLSearchParams({ external_source: 'imdb_id' }); if (!this.isAccessToken()) params.set('api_key', this.apiKey);
    const response = await this.request(`https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?${params}`);
    if (!response.ok) return null; const found = await response.json() as any;
    const movie = found.movie_results?.[0]; if (movie) return { id: String(movie.id), title: movie.title, year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null, score: 1, mediaType: 'movie' };
    const show = found.tv_results?.[0]; if (show) return { id: String(show.id), title: show.name, year: show.first_air_date ? Number(show.first_air_date.slice(0, 4)) : null, score: 1, mediaType: 'tv' };
    const episode = found.tv_episode_results?.[0];
    if (episode) {
      const parentShow = await this.getDetails(String(episode.show_id), 'tv');
      if (parentShow && Number.isInteger(episode.season_number) && Number.isInteger(episode.episode_number)) {
        return { id: String(episode.show_id), title: parentShow.title, year: parentShow.year, score: 1, mediaType: 'tv', season: episode.season_number, episode: episode.episode_number };
      }
    }
    return null;
  }

  private isAccessToken(): boolean { return this.apiKey.split('.').length === 3; }
  private request(url: string): Promise<Response> {
    return fetch(url, { signal: AbortSignal.timeout(externalRequestTimeoutMs), headers: this.isAccessToken() ? { authorization: `Bearer ${this.apiKey}`, accept: 'application/json' } : { accept: 'application/json' } });
  }
}
