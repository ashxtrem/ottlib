import { readdir } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import type { MediaTrack } from '@ottlib/shared';

const subtitleExtensions: Record<string, string> = { '.srt': 'SRT', '.ass': 'ASS', '.ssa': 'SSA', '.vtt': 'WebVTT', '.sub': 'VobSub' };
const languageTokens = new Set(['ar', 'ara', 'bn', 'ben', 'de', 'deu', 'en', 'eng', 'es', 'spa', 'fr', 'fra', 'hi', 'hin', 'it', 'ita', 'ja', 'jpn', 'ko', 'kor', 'ml', 'mal', 'pt', 'por', 'ru', 'rus', 'ta', 'tam', 'te', 'tel', 'zh', 'zho']);
const ignoredTokens = new Set(['forced', 'foreign', 'sdh', 'cc', 'hearing', 'impaired', 'subtitle', 'subtitles', 'sub', 'full', 'default', '1080p', '2160p', '720p', '480p', 'web', 'webdl', 'webrip', 'bluray', 'brrip', 'remux', 'x264', 'x265', 'hevc']);

function stem(path: string): string { return basename(path, extname(path)); }
function titleKey(value: string): string {
  return value.toLowerCase().split(/[. _-]+/).filter((token) => token && !ignoredTokens.has(token) && !languageTokens.has(token)).join(' ');
}
function associatedWith(videoPath: string, subtitlePath: string): boolean {
  const video = titleKey(stem(videoPath)); const subtitle = titleKey(stem(subtitlePath));
  return video.length >= 3 && subtitle.length >= 3 && (video === subtitle || video.startsWith(`${subtitle} `) || subtitle.startsWith(`${video} `));
}
function subtitleLanguage(value: string): string | null {
  return stem(value).toLowerCase().split(/[. _-]+/).find((token) => languageTokens.has(token)) ?? null;
}

export interface ExternalSubtitleFile { track: MediaTrack; path: string }

export async function findExternalSubtitleFiles(videoPath: string): Promise<ExternalSubtitleFile[]> {
  try {
    const entries = (await readdir(dirname(videoPath), { withFileTypes: true, encoding: 'utf8' })).sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    return entries.flatMap((entry, index): ExternalSubtitleFile[] => {
      const subtitlePath = entry.name;
      const extension = extname(subtitlePath).toLowerCase();
      if (!entry.isFile() || !subtitleExtensions[extension] || !associatedWith(videoPath, subtitlePath)) return [];
      const normalized = stem(subtitlePath).toLowerCase();
      return [{
        path: join(dirname(videoPath), subtitlePath),
        track: {
          type: 'subtitle', source: 'external', order: 10_000 + index, language: subtitleLanguage(subtitlePath), codec: subtitleExtensions[extension], channels: null, channelLayout: null,
          title: normalized.includes('sdh') ? 'SDH' : normalized.includes('cc') ? 'CC' : null,
          isDefault: normalized.includes('default'), isForced: normalized.includes('forced') || normalized.includes('foreign'), isHearingImpaired: normalized.includes('sdh') || normalized.includes('cc') || normalized.includes('hearing')
        }
      }];
    });
  } catch { return []; }
}

export async function findExternalSubtitleTracks(videoPath: string): Promise<MediaTrack[]> {
  return (await findExternalSubtitleFiles(videoPath)).map((file) => file.track);
}
