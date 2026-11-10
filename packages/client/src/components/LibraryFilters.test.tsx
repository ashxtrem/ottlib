import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LibraryFilters, countActiveFilters } from './LibraryFilters';

const callbacks = { onSearchChange: vi.fn(), onAvailabilityChange: vi.fn(), onGenreChange: vi.fn(), onActorChange: vi.fn(), onQualityChange: vi.fn(), onAudioLanguageChange: vi.fn(), onMinRatingChange: vi.fn(), onWatchedChange: vi.fn(), onSortChange: vi.fn(), onClearFilters: vi.fn() };

describe('LibraryFilters', () => {
  it('counts every non-default filter', () => {
    expect(countActiveFilters({ search: 'Arrival', availability: 'unavailable', mediaType: 'tv', genre: 'Sci-Fi', collection: '12', actor: '', quality: '4K', audioLanguage: 'hin', minRating: 8, watched: false, sort: 'year', needsReview: true })).toBe(10);
  });

  it('renders only search and the filter trigger by default', () => {
    const markup = renderToStaticMarkup(<LibraryFilters values={{ search: '', availability: undefined, genre: '', actor: '', quality: '', audioLanguage: '', minRating: undefined, watched: undefined, sort: 'title' }} options={{ genres: [], actors: [], resolutions: [], audioLanguages: [], collections: [] }} idPrefix="test" {...callbacks} />);
    expect(markup).toContain('Filters');
    expect(markup).not.toContain('Minimum rating');
  });

  const values = { search: '', availability: undefined, genre: '', actor: '', quality: '', audioLanguage: '', minRating: undefined, watched: undefined, sort: 'title' };
  const options = { genres: [], actors: [], resolutions: [], audioLanguages: [], collections: [{ id: 12, name: 'Alien Collection', count: 4 }] };

  it('counts a shelf page the same without a collection', () => {
    expect(countActiveFilters(values)).toBe(0);
  });

  it('shows the active collection by name', () => {
    const markup = renderToStaticMarkup(<LibraryFilters values={{ ...values, collection: '12' }} options={options} idPrefix="test" onCollectionChange={vi.fn()} {...callbacks} />);
    expect(markup).toContain('Collection: Alien Collection');
  });

  it('puts the shortcut id on the search input and lists no recents until it is focused', () => {
    const markup = renderToStaticMarkup(<LibraryFilters values={values} options={options} idPrefix="test" searchInputId="library-search" recentSearches={['alien']} {...callbacks} />);
    expect(markup).toContain('id="library-search"');
    expect(markup).not.toContain('Recent searches');
  });
});
