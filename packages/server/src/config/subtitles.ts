export const subtitleLimits = {
  maxBytes: 5 * 1024 * 1024, maxArchiveBytes: 10 * 1024 * 1024,
  maxArchiveEntries: 100, searchTtlMs: 15 * 60_000, maxSearchResults: 2000,
  maxResultsPerProvider: 50, timeoutMs: 20_000, maxRedirects: 3,
};
export const subtitleFormats: Record<string, { codec: string; mimeType: string }> = {
  srt: { codec: 'SRT', mimeType: 'application/x-subrip' },
  vtt: { codec: 'WebVTT', mimeType: 'text/vtt' },
  ass: { codec: 'ASS', mimeType: 'text/x-ssa' },
  ssa: { codec: 'SSA', mimeType: 'text/x-ssa' },
};
export const subtitleLanguageAliases: Record<string, string> = {
  eng: 'en', english: 'en', hin: 'hi', hindi: 'hi', tam: 'ta', tamil: 'ta',
  tel: 'te', telugu: 'te', mal: 'ml', malayalam: 'ml', kan: 'kn', kannada: 'kn',
  ben: 'bn', bengali: 'bn', mar: 'mr', marathi: 'mr', ara: 'ar', arabic: 'ar',
  fra: 'fr', fre: 'fr', french: 'fr', deu: 'de', ger: 'de', german: 'de',
  spa: 'es', spanish: 'es', ita: 'it', italian: 'it', por: 'pt', portuguese: 'pt',
  rus: 'ru', russian: 'ru', jpn: 'ja', japanese: 'ja', kor: 'ko', korean: 'ko',
  zho: 'zh-cn', chi: 'zh-cn', chinese: 'zh-cn', per: 'fa', fas: 'fa', persian: 'fa', tur: 'tr', turkish: 'tr',
};
export const subtitleDownloadHosts = ['www.opensubtitles.com', 'dl.opensubtitles.com', 'api.opensubtitles.com', 'vip-api.opensubtitles.com', 'dl.subdl.com', 'api.subdl.com'];
