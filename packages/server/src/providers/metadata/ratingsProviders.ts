import type { Settings } from '@ottlib/shared';
import type { RatingsProvider } from './RatingsProvider.js';
import { OmdbProvider } from './omdbProvider.js';

export function createRatingsProviders(settings: Settings): RatingsProvider[] {
  return settings.omdbApiKey ? [new OmdbProvider(settings.omdbApiKey)] : [];
}
