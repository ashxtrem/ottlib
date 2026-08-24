import { describe, expect, it } from 'vitest';
import { initialLibraryViewState, libraryStateFromSearchParams, libraryStateToSearchParams } from './useLibraryViewState';

describe('library URL state', () => {
  it('reads shareable filter parameters', () => {
    expect(libraryStateFromSearchParams(new URLSearchParams('genre=Sci-Fi&actor=Asha+Patel&quality=4K&audioLanguage=hin&availability=unavailable&mediaType=tv&watched=false&sort=quality&minRating=8&needsReview=true'))).toEqual({ search: '', genre: 'Sci-Fi', actor: 'Asha Patel', quality: '4K', audioLanguage: 'hin', availability: 'unavailable', mediaType: 'tv', watched: false, sort: 'quality', minRating: 8, needsReview: true });
  });

  it('omits default filters from URLs', () => {
    expect(libraryStateFromSearchParams(new URLSearchParams()).availability).toBe('available');
    expect(libraryStateFromSearchParams(new URLSearchParams('availability=all')).availability).toBeUndefined();
    expect(libraryStateToSearchParams(initialLibraryViewState).toString()).toBe('');
    expect(libraryStateToSearchParams({ ...initialLibraryViewState, genre: 'Drama', actor: 'Asha Patel', quality: '4K', audioLanguage: 'hin', mediaType: 'movie' }).toString()).toBe('genre=Drama&actor=Asha+Patel&quality=4K&audioLanguage=hin&mediaType=movie');
    expect(libraryStateToSearchParams({ ...initialLibraryViewState, availability: undefined }).toString()).toBe('availability=all');
  });
});
