import type { Settings, TorrentPreferredCodec, TorrentPreferredResolution, TorrentQuality } from '@ottlib/shared';
import { releaseResolutionLadder, releaseScoreSourcePattern, releaseScoreWeights } from '../../config/defaults.js';

/** What the user prefers in a release; every field is null when it was left unset in Settings. */
export interface ReleasePreferences {
  resolution: TorrentPreferredResolution | null;
  codec: TorrentPreferredCodec | null;
  maxSizeGb: number | null;
}

export interface ScorableRelease { quality: TorrentQuality; nbSeeders: number | null; fileSize: number | null }

export const noReleasePreferences: ReleasePreferences = { resolution: null, codec: null, maxSizeGb: null };

export function releasePreferences(settings: Pick<Settings, 'torrentPreferredResolution' | 'torrentPreferredCodec' | 'torrentMaxSizeGb'>): ReleasePreferences {
  return { resolution: settings.torrentPreferredResolution, codec: settings.torrentPreferredCodec, maxSizeGb: settings.torrentMaxSizeGb };
}

const bytesPerGb = 1024 ** 3;

/** 0-100 for how well a release fits the preferences, or null when no preference is set. Over the size cap scores 0. */
export function releaseScore(release: ScorableRelease, preferences: ReleasePreferences): number | null {
  if (preferences.resolution === null && preferences.codec === null && preferences.maxSizeGb === null) return null;
  if (preferences.maxSizeGb !== null && release.fileSize !== null && release.fileSize > preferences.maxSizeGb * bytesPerGb) return 0;
  const points = resolutionPoints(release.quality.resolution, preferences.resolution)
    + codecPoints(release.quality.codec, preferences.codec)
    + seederPoints(release.nbSeeders)
    + sourcePoints(release.quality.source);
  return Math.round(Math.min(100, points));
}

function resolutionPoints(actual: string | null, preferred: TorrentPreferredResolution | null): number {
  if (!preferred || !actual) return 0;
  const ladder: readonly string[] = releaseResolutionLadder;
  const have = ladder.indexOf(actual.toLowerCase()); const want = ladder.indexOf(preferred);
  if (have < 0) return 0;
  if (have === want) return releaseScoreWeights.resolutionExact;
  if (have === want - 1) return releaseScoreWeights.resolutionOneBelow;
  return have > want ? releaseScoreWeights.resolutionAbove : 0;
}

function codecFamily(codec: string | null): TorrentPreferredCodec | null {
  const value = codec?.toLowerCase();
  if (value === 'x265' || value === 'hevc' || value === 'h265') return 'hevc';
  if (value === 'x264' || value === 'h264') return 'h264';
  return value === 'av1' ? 'av1' : null;
}

function codecPoints(actual: string | null, preferred: TorrentPreferredCodec | null): number {
  return preferred && codecFamily(actual) === preferred ? releaseScoreWeights.codec : 0;
}

function seederPoints(seeders: number | null): number {
  if (!seeders || seeders <= 0) return 0;
  const share = Math.log10(1 + seeders) / Math.log10(1 + releaseScoreWeights.seedersFullAt);
  return releaseScoreWeights.seeders * Math.min(1, share);
}

function sourcePoints(source: string | null): number {
  return source && releaseScoreSourcePattern.test(source) ? releaseScoreWeights.source : 0;
}
