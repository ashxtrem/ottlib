import type { Movie } from '@ottlib/shared';

type Episode = Pick<Movie, 'mediaType' | 'season' | 'episode'>;

/** Same wording as the Android apps' details screen. */
export function nextLabel(next: Pick<Movie, 'mediaType'>): string {
  return next.mediaType === 'tv' ? 'Next episode' : 'Up next';
}

/** A note when the next available episode skips some, e.g. S1E3 → S1E5 or S1E8 → S3E1. */
export function episodeGapAfter(next: Episode, current: Episode): string | null {
  if (next.mediaType !== 'tv' || current.mediaType !== 'tv') return null;
  if (!current.season || !current.episode || !next.season || !next.episode) return null;
  const skipsEpisodes = next.season === current.season && next.episode > current.episode + 1;
  const skipsSeasons = next.season > current.season && (next.season > current.season + 1 || next.episode > 1);
  return skipsEpisodes || skipsSeasons ? `Some episodes are unavailable. Next available: S${next.season}E${next.episode}.` : null;
}
