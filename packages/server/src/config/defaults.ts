export const defaultExtensions = ['mp4', 'mkv', 'avi', 'mov', 'm4v', 'wmv', 'flv', 'webm'];
export const defaultIgnoredPatterns = ['.git', '@eaDir', 'sample', 'samples', 'extra', 'extras'];
export const externalRequestTimeoutMs = 15_000;
export const releaseQualityTagPatterns = {
  resolution: /\b(?:2160p|4k|1440p|1080p|720p|480p)\b/i,
  source: /\b(?:blu[ -]?ray|brrip|web[ .-]?dl|webrip|hdtv|dvdrip|remux|hdrip)\b/i,
  codec: /\b(?:x265|hevc|h\.?(?:265)|x264|h\.?(?:264)|av1|xvid)\b/i
} as const;
export const releaseTags = new RegExp(`${releaseQualityTagPatterns.resolution.source}|${releaseQualityTagPatterns.source.source}|${releaseQualityTagPatterns.codec.source}|\\b(?:aac|dts|atmos|truehd|dual[ .-]?audio|multi|proper|repack|extended|unrated|limited)\\b`, 'gi');
export const episodeTags = /\b(?:s\d{1,2}\s?e\d{1,3}|\d{1,2}x\d{2,3}|season\s?\d{1,2}(?:\s?episode\s?\d{1,3})?|episode\s?\d{1,3})\b/gi;
export const releaseYearUpperBoundOffset = 1;
export const defaultSettings = {
  tmdbApiKey: '',
  omdbApiKey: '',
  torrentSearchEnabled: false,
  qbittorrentUrl: '',
  qbittorrentUsername: '',
  qbittorrentPassword: '',
  qbittorrentCategory: 'ottlib',
  qbittorrentSavePath: '',
  extensions: defaultExtensions,
  ignoredPatterns: defaultIgnoredPatterns,
  excludedFolders: [],
  scheduleEnabled: false,
  scheduleCron: '0 3 * * *'
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
