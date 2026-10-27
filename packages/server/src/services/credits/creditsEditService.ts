import type { AutoSkipDefaults, Credits } from '@ottlib/shared';
import type { AutoSkipRepository } from '../../repositories/autoSkipRepository.js';
import type { MovieRepository } from '../../repositories/movieRepository.js';
import { CreditsResolver, defaultScopeKey, titleScopeKey } from './creditsResolver.js';

/** The title does not exist; routes answer 404. */
export class CreditsMovieNotFoundError extends Error {
  public constructor() { super('Movie not found'); }
}

/** User edits: the shared "credits start here" mark and a profile's auto-skip choices. */
export class CreditsEditService {
  public constructor(private readonly movies: MovieRepository, private readonly autoSkip: AutoSkipRepository, private readonly resolver: CreditsResolver) {}

  /** Sets or clears the mark (shared by every profile) and answers with the credits the title now resolves to. */
  public setMark(id: number, startMs: number | null): Credits | null {
    if (!this.movies.getCredits(id)) throw new CreditsMovieNotFoundError();
    this.movies.setCreditsMark(id, startMs);
    return this.resolver.credits(id);
  }

  /** Sets or clears this profile's override for the movie, or for an episode's whole series. Answers with the effective choice. */
  public setOverride(profileId: number, id: number, enabled: boolean | null): boolean {
    const row = this.movies.getCredits(id);
    if (!row) throw new CreditsMovieNotFoundError();
    const scope = titleScopeKey(row);
    if (enabled === null) this.autoSkip.clear(profileId, scope); else this.autoSkip.set(profileId, scope, enabled);
    return this.resolver.autoSkip(id, profileId);
  }

  public defaults(profileId: number): AutoSkipDefaults { return this.resolver.defaults(profileId); }

  public setDefaults(profileId: number, defaults: AutoSkipDefaults): AutoSkipDefaults {
    this.autoSkip.set(profileId, defaultScopeKey('movie'), defaults.movie);
    this.autoSkip.set(profileId, defaultScopeKey('tv'), defaults.tv);
    return this.resolver.defaults(profileId);
  }
}
