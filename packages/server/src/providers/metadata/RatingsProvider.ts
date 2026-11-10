export type OutsideRatingSource = 'imdb' | 'rottenTomatoes' | 'metacritic';
export interface OutsideRating { source: OutsideRatingSource; value: number; max: number }

export interface RatingsProvider {
  name: string;
  getRatings(imdbId: string): Promise<OutsideRating[]>;
}

/** The provider's daily request quota is used up: callers stop asking it for the rest of the run. */
export class RatingsLimitReachedError extends Error {
  public constructor(provider: string, detail: string) {
    super(`${provider} ${detail}`);
    this.name = 'RatingsLimitReachedError';
  }
}
