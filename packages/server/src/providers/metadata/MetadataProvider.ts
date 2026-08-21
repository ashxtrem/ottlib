export type MediaType = 'movie' | 'tv';
export interface MetadataCandidate { id: string; title: string; year: number | null; score: number; mediaType: MediaType }
export interface MovieMetadata {
  providerId: string; title: string; year: number | null; overview: string | null; posterUrl: string | null; backdropUrl: string | null;
  genres: string[]; cast: string[]; rating: number | null; runtime: number | null; imdbId: string | null;
}
export interface EpisodeMetadata { title: string; overview: string | null; stillUrl: string | null; rating: number | null }
export interface MetadataProvider {
  name: string;
  searchCandidates(title: string, year?: number, limit?: number): Promise<MetadataCandidate[]>;
  getDetails(providerId: string, mediaType: MediaType): Promise<MovieMetadata | null>;
  getByImdbId?(imdbId: string): Promise<MetadataCandidate | null>;
  getEpisodeDetails?(providerId: string, season: number, episode: number): Promise<EpisodeMetadata | null>;
}
