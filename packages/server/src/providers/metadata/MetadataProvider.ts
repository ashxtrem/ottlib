import type { OutsideRating } from './RatingsProvider.js';

export type MediaType = 'movie' | 'tv';
export interface MetadataCandidate { id: string; title: string; year: number | null; score: number; mediaType: MediaType; season?: number; episode?: number }
export interface MovieMetadata {
  providerId: string; title: string; year: number | null; overview: string | null; posterUrl: string | null; backdropUrl: string | null;
  genres: string[]; cast: string[]; rating: number | null; runtime: number | null; imdbId: string | null;
  /** Remote photo urls; only providers with person images fill these. */
  castMembers?: CastMemberMetadata[]; logoUrl?: string | null; collection?: { id: number; name: string } | null; trailerKey?: string | null;
  ratings?: OutsideRating[];
}
export interface CastMemberMetadata { name: string; photoUrl: string | null }
export interface CollectionPart { id: string; title: string; year: number | null; posterUrl: string | null }
export interface TitleCollection { id: number; name: string; parts: CollectionPart[] }
export interface EpisodeMetadata { title: string; overview: string | null; stillUrl: string | null; rating: number | null }
export interface MetadataProvider {
  name: string;
  searchCandidates(title: string, year?: number, limit?: number): Promise<MetadataCandidate[]>;
  getDetails(providerId: string, mediaType: MediaType): Promise<MovieMetadata | null>;
  getByImdbId?(imdbId: string): Promise<MetadataCandidate | null>;
  getEpisodeDetails?(providerId: string, season: number, episode: number): Promise<EpisodeMetadata | null>;
  /** Provider ids of titles viewers of this one also liked, best first. Optional: only some providers have the data. */
  getRecommendations?(providerId: string, mediaType: MediaType): Promise<string[]>;
  /** The titles of a film collection (saga). Optional: only some providers have collections. */
  getCollection?(collectionId: number): Promise<TitleCollection | null>;
}
