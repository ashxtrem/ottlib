import type { Settings } from '@ottlib/shared';
import type { MetadataProvider } from './MetadataProvider.js';
import { OmdbProvider } from './omdbProvider.js';
import { TmdbProvider } from './tmdbProvider.js';

export function createMetadataProviders(settings: Settings): MetadataProvider[] {
  const providers: Array<TmdbProvider | OmdbProvider | null> = [settings.tmdbApiKey ? new TmdbProvider(settings.tmdbApiKey) : null, settings.omdbApiKey ? new OmdbProvider(settings.omdbApiKey) : null];
  return providers.filter((provider): provider is TmdbProvider | OmdbProvider => provider !== null);
}
