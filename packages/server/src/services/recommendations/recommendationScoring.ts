import type { RecommendationPoolRow } from '../../repositories/movieRepository.js';

/** A library title as the recommender sees it: matched metadata only. */
export type PoolTitle = RecommendationPoolRow;

export interface ScoredTitle { title: PoolTitle; score: number; reason: string }

const weights = { genre: 0.3, cast: 0.15, franchise: 0.3, signal: 0.2, year: 0.025, rating: 0.025 } as const;
/** Below this a title shares too little with the anchor to be worth showing. */
export const minimumScore = 0.12;
const differentMediaTypeFactor = 0.6;
const topBilledCast = 8;

/** How many titles carry each genre; rare genres say more about taste than "Drama" does. */
export function genreFrequencies(pool: PoolTitle[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const title of pool) for (const genre of new Set(title.genres)) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  return counts;
}

function genreWeight(genre: string, frequencies: Map<string, number>, poolSize: number): number {
  return Math.log(1 + poolSize / (1 + (frequencies.get(genre) ?? 0)));
}

/** Weighted Jaccard: shared genre weight over the weight of all genres either title has. */
export function genreSimilarity(left: string[], right: string[], frequencies: Map<string, number>, poolSize: number): { score: number; shared: string[] } {
  const a = new Set(left); const b = new Set(right);
  const shared = [...a].filter((genre) => b.has(genre)).sort((x, y) => genreWeight(y, frequencies, poolSize) - genreWeight(x, frequencies, poolSize));
  const union = new Set([...a, ...b]);
  if (!union.size) return { score: 0, shared };
  const sharedWeight = shared.reduce((sum, genre) => sum + genreWeight(genre, frequencies, poolSize), 0);
  const unionWeight = [...union].reduce((sum, genre) => sum + genreWeight(genre, frequencies, poolSize), 0);
  return { score: unionWeight ? sharedWeight / unionWeight : 0, shared };
}

export function sharedCast(left: string[], right: string[]): string[] {
  const top = new Set(right.slice(0, topBilledCast));
  return left.slice(0, topBilledCast).filter((name) => top.has(name));
}

const trailingSequel = /\s+(?:part\s+)?(?:\d{1,4}|[ivx]{1,4})$/;

/** "Alien 3", "Alien: Resurrection" and "Alien" share a franchise key; short or numeric-only keys never match. */
export function franchiseKey(title: string): string {
  const base = title.toLowerCase().split(/\s*(?::|\s-\s|·)\s*/)[0].replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().replace(trailingSequel, '').trim();
  return base.length >= 4 ? base : '';
}

function proximity(left: number | null, right: number | null, halfLife: number): number {
  return left === null || right === null ? 0 : 0.5 ** (Math.abs(left - right) / halfLife);
}

function ratingSimilarity(left: number | null, right: number | null): number {
  return left === null || right === null ? 0 : Math.max(0, 1 - Math.abs(left - right) / 4);
}

export interface Signal { rankOf(candidate: PoolTitle): number | undefined; size: number }

export function scoreCandidate(anchor: PoolTitle, candidate: PoolTitle, frequencies: Map<string, number>, poolSize: number, signal: Signal | null): ScoredTitle {
  const genre = genreSimilarity(anchor.genres, candidate.genres, frequencies, poolSize);
  const cast = sharedCast(anchor.cast, candidate.cast);
  const castScore = Math.min(cast.length, 3) / 3;
  const anchorFranchise = franchiseKey(anchor.title);
  const franchise = anchorFranchise !== '' && anchorFranchise === franchiseKey(candidate.title) ? 1 : 0;
  const rank = signal?.rankOf(candidate);
  const signalScore = rank === undefined || !signal ? 0 : 1 - (rank / Math.max(signal.size, 1)) * 0.5;

  const parts = {
    genre: weights.genre * genre.score, cast: weights.cast * castScore, franchise: weights.franchise * franchise, signal: weights.signal * signalScore,
    year: weights.year * proximity(anchor.year, candidate.year, 10), rating: weights.rating * ratingSimilarity(anchor.rating, candidate.rating)
  };
  const typeFactor = anchor.mediaType && candidate.mediaType && anchor.mediaType !== candidate.mediaType ? differentMediaTypeFactor : 1;
  // Year and rating only order titles that already share something; alone they would recommend anything from the same era.
  const topical = parts.genre + parts.cast + parts.franchise + parts.signal;
  const score = topical === 0 ? 0 : (topical + parts.year + parts.rating) * typeFactor;
  return { title: candidate, score, reason: reasonFor(parts, genre.shared, cast) };
}

function reasonFor(parts: { genre: number; cast: number; franchise: number; signal: number }, sharedGenres: string[], cast: string[]): string {
  const strongest = (Object.entries(parts) as Array<[keyof typeof parts, number]>).reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  if (strongest[1] === 0) return 'Similar to this title';
  if (strongest[0] === 'franchise') return 'Same franchise';
  if (strongest[0] === 'signal') return 'Viewers of this title also liked it';
  if (strongest[0] === 'cast' && cast.length) return `Also stars ${cast[0]}`;
  return sharedGenres.length ? `Shares genres: ${sharedGenres.slice(0, 2).join(', ')}` : 'Similar to this title';
}

/** Highest score first; ties keep better-rated, then lower-id titles first so results are stable. */
export function rank(scored: ScoredTitle[]): ScoredTitle[] {
  return scored.filter((entry) => entry.score >= minimumScore)
    .sort((a, b) => b.score - a.score || (b.title.rating ?? 0) - (a.title.rating ?? 0) || a.title.id - b.title.id);
}
