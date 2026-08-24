import type { TorrentQuality } from '@ottlib/shared';
import { releaseQualityTagPatterns } from '../../config/defaults.js';

function firstMatch(name: string, pattern: RegExp, normalizer: (value: string) => string): string | null {
  const match = pattern.exec(name)?.[0];
  return match ? normalizer(match) : null;
}

export function releaseQuality(name: string): TorrentQuality {
  return {
    resolution: firstMatch(name, releaseQualityTagPatterns.resolution, (value) => /^4k$/i.test(value) ? '2160p' : value.toLowerCase()),
    source: firstMatch(name, releaseQualityTagPatterns.source, (value) => value.replace(/[ .-]/g, '').toUpperCase().replace('BLURAY', 'BluRay').replace('WEBRIP', 'WEBRip').replace('WEBDL', 'WEB-DL')),
    codec: firstMatch(name, releaseQualityTagPatterns.codec, (value) => value.replace('.', '').toUpperCase().replace('HEVC', 'HEVC').replace('X265', 'x265').replace('X264', 'x264')),
    group: releaseGroup(name)
  };
}

function releaseGroup(name: string): string | null {
  const withoutExtension = name.replace(/\.(?:mkv|mp4|avi|mov|m4v|wmv|flv|webm)$/i, '');
  const match = /-([A-Za-z0-9][A-Za-z0-9_-]{1,})$/.exec(withoutExtension)?.[1];
  return match && !/^(?:web|dl|x264|x265|h264|h265)$/i.test(match) ? match : null;
}
