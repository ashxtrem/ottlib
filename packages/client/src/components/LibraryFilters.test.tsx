import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LibraryFilters, countActiveFilters } from './LibraryFilters';

const callbacks = { onSearchChange: vi.fn(), onAvailabilityChange: vi.fn(), onGenreChange: vi.fn(), onActorChange: vi.fn(), onQualityChange: vi.fn(), onAudioLanguageChange: vi.fn(), onMinRatingChange: vi.fn(), onWatchedChange: vi.fn(), onSortChange: vi.fn(), onClearFilters: vi.fn() };

describe('LibraryFilters', () => {
  it('counts every non-default filter', () => {
    expect(countActiveFilters({ search: 'Arrival', availability: 'unavailable', genre: 'Sci-Fi', actor: '', quality: '4K', audioLanguage: 'hin', minRating: 8, watched: false, sort: 'year', needsReview: true })).toBe(8);
  });

  it('renders only search and the filter trigger by default', () => {
    const markup = renderToStaticMarkup(<LibraryFilters values={{ search: '', availability: undefined, genre: '', actor: '', quality: '', audioLanguage: '', minRating: undefined, watched: undefined, sort: 'title' }} options={{ genres: [], actors: [], resolutions: [], audioLanguages: [] }} idPrefix="test" {...callbacks} />);
    expect(markup).toContain('Filters');
    expect(markup).not.toContain('Minimum rating');
  });
});
