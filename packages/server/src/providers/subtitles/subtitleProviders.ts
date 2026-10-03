import type { Settings } from '@ottlib/shared';
import { OpensubtitlesProvider } from './opensubtitlesProvider.js';
import { SubdlProvider } from './subdlProvider.js';
import type { SubtitleProvider } from './SubtitleProvider.js';

export function subtitleProviders(settings: () => Settings): SubtitleProvider[] {
  return [new OpensubtitlesProvider(settings), new SubdlProvider(settings)];
}
