import type { Movie } from '@ottlib/shared';
import { describe, expect, it } from 'vitest';
import { filterShelfMovies, initialShelfMovieFilters, shelfMovieFilterOptions, toShelfPosterItems } from './shelfMovieFilters';

function mediaInfo(height: number, hdrFormat: string | null, language: string): NonNullable<Movie['mediaInfo']> {
  return {
    container: 'matroska', durationMs: null, width: height >= 2160 ? 3840 : 1920, height, videoCodec: null, videoProfile: null, videoBitRate: null, hdrFormat,
    tracks: [{ type: 'audio', source: 'embedded', order: 0, language, title: null, codec: null, channels: null, channelLayout: null, isDefault: true, isForced: false, isHearingImpaired: false }]
  };
}

const movies: Movie[] = [
  {
    id: 1, title: 'Dragon Dawn', year: 2024, rawFilename: 'dragon-dawn.mkv', filePath: 'D:/media/dragon-dawn.mkv', titleOverride: null, overview: null, posterUrl: null,
    backdropUrl: null, genres: ['Action'], cast: ['Asha Patel'], rating: 8.1, runtime: null, imdbId: 'tt0000001', metadataStatus: 'matched', metadataSource: null, mediaType: 'movie', season: null, episode: null, fileSizeBytes: 1, watched: false, resumePositionMs: null,
    missing: false, addedAt: '2025-01-01T00:00:00.000Z', shelves: [{ id: 7, name: 'Anime' }], mediaInfo: mediaInfo(2160, 'HDR10', 'jpn')
  },
  {
    id: 2, title: 'Quiet Night', year: 2022, rawFilename: 'quiet-night.mkv', filePath: 'D:/media/quiet-night.mkv', titleOverride: null, overview: null, posterUrl: null,
    backdropUrl: null, genres: ['Drama'], cast: ['Morgan Lee'], rating: 6.5, runtime: null, imdbId: null, metadataStatus: 'suggested', metadataSource: null, mediaType: null, season: null, episode: null, fileSizeBytes: 1, watched: true, resumePositionMs: null,
    missing: true, addedAt: '2024-01-01T00:00:00.000Z', shelves: [], mediaInfo: mediaInfo(1080, null, 'eng')
  }
];

describe('shelf movie filters', () => {
  it('derives filter options from the titles in the shelf', () => {
    expect(shelfMovieFilterOptions(movies)).toEqual({ genres: ['Action', 'Drama'], actors: ['Asha Patel', 'Morgan Lee'], resolutions: ['4K', '1080p'], audioLanguages: ['eng', 'jpn'] });
  });

  it('filters shelf titles and keeps the poster card fields', () => {
    const filtered = filterShelfMovies(movies, { ...initialShelfMovieFilters, search: 'dragon', quality: '4K', audioLanguage: 'jpn', watched: false });
    expect(filtered.map((movie) => movie.id)).toEqual([1]);
    expect(toShelfPosterItems(filtered)).toEqual([expect.objectContaining({ id: 1, resolution: '4K', hdrFormat: 'HDR10', watched: false, shelves: [{ id: 7, name: 'Anime' }] })]);
  });
});
