import type { Settings } from '@ottlib/shared';

export const defaultExtensions = ['mp4', 'mkv', 'avi', 'mov', 'm4v', 'wmv', 'flv', 'webm'];
export const defaultIgnoredPatterns = ['.git', '@eaDir', 'sample', 'samples', 'extra', 'extras'];
export const externalRequestTimeoutMs = 15_000;
export const releaseQualityTagPatterns = {
  resolution: /\b(?:2160p|4k|1440p|1080p|720p|480p)\b/i,
  source: /\b(?:blu[ -]?ray|brrip|web[ .-]?dl|webrip|hdtv|dvdrip|remux|hdrip)\b/i,
  codec: /\b(?:x265|hevc|h\.?(?:265)|x264|h\.?(?:264)|av1|xvid)\b/i
} as const;
/** Points a torrent result earns toward its 0-100 score (resolution 50 + codec 20 + seeders 20 + source 10). */
export const releaseScoreWeights = {
  resolutionExact: 50,
  resolutionOneBelow: 25,
  resolutionAbove: 15,
  codec: 20,
  seeders: 20,
  source: 10,
  /** Seeder count at which the seeder points reach their maximum (log scale). */
  seedersFullAt: 1000
} as const;
/** Release resolutions from lowest to highest; a preference is compared by position in this ladder. */
export const releaseResolutionLadder = ['480p', '720p', '1080p', '1440p', '2160p'] as const;
/** Release source tags (as `releaseQuality` normalises them) that earn the source points. */
export const releaseScoreSourcePattern = /^(?:bluray|web-dl|webrip)$/i;
/** Stored `movies.video_codec` labels (upper-case) of old codecs that make a title an upgrade candidate. */
export const oldVideoCodecs = ['MPEG-4', 'MPEG-2', 'MPEG2VIDEO', 'XVID', 'VC1', 'VC-1', 'WMV1', 'WMV2', 'WMV3', 'MSMPEG4V1', 'MSMPEG4V2', 'MSMPEG4V3'] as const;
/** Heights a preferred resolution needs; mirrors the buckets of `formatResolution`. */
export const preferredResolutionMinimumHeight = { '2160p': 2160, '1080p': 1080, '720p': 720 } as const;
export const upgradeCandidateLimit = 200;
export const releaseTags = new RegExp(`${releaseQualityTagPatterns.resolution.source}|${releaseQualityTagPatterns.source.source}|${releaseQualityTagPatterns.codec.source}|\\b(?:aac|dts|atmos|truehd|dual[ .-]?audio|multi|proper|repack|extended|unrated|limited)\\b`, 'gi');
export const episodeTags = /\b(?:s\d{1,2}\s?e\d{1,3}|\d{1,2}x\d{2,3}|season\s?\d{1,2}(?:\s?episode\s?\d{1,3})?|episode\s?\d{1,3})\b/gi;
export const releaseYearUpperBoundOffset = 1;
/** A title added within this many days (and unwatched) carries the "new" mark. */
export const FRESH_DAYS = 14;
export const defaultSettings = {
  tmdbApiKey: '',
  omdbApiKey: '',
  opensubtitlesApiKey: '',
  opensubtitlesUsername: '',
  opensubtitlesPassword: '',
  subdlApiKey: '',
  subtitleSearchLanguages: ['en'],
  torrentSearchEnabled: false,
  qbittorrentUrl: '',
  qbittorrentUsername: '',
  qbittorrentPassword: '',
  qbittorrentCategory: 'ottlib',
  qbittorrentSavePath: '',
  torrentPreferredResolution: null as Settings['torrentPreferredResolution'],
  torrentPreferredCodec: null as Settings['torrentPreferredCodec'],
  torrentMaxSizeGb: null as Settings['torrentMaxSizeGb'],
  extensions: defaultExtensions,
  ignoredPatterns: defaultIgnoredPatterns,
  excludedFolders: [],
  scheduleEnabled: false,
  scheduleCron: '0 3 * * *',
  transcodeEncoder: 'auto' as const,
  backupEnabled: true,
  updateCheckEnabled: true
};

export const mimeTypes: Record<string, string> = {
  mp4: 'video/mp4', mkv: 'video/x-matroska', avi: 'video/x-msvideo', mov: 'video/quicktime',
  m4v: 'video/x-m4v', wmv: 'video/x-ms-wmv', flv: 'video/x-flv', webm: 'video/webm'
};

/** Text subtitle formats a native player can side-load, keyed by lower-case file extension. */
export const subtitleMimeTypes: Record<string, string> = {
  srt: 'application/x-subrip', ass: 'text/x-ssa', ssa: 'text/x-ssa', vtt: 'text/vtt'
};

export const playbackProgressRules = {
  /** Positions before this are treated as an accidental open and not saved. */
  minimumPositionMs: 120_000,
  /** At or beyond this fraction of the duration the title counts as watched and progress is cleared. */
  watchedFraction: 0.92
} as const;

export const discoveryServiceType = 'ottlib';
