import type { AutoSkipDefaults, Credits } from '@ottlib/shared';
import { creditsConfig } from '../../config/credits.js';
import type { AutoSkipRepository } from '../../repositories/autoSkipRepository.js';
import type { CreditsRow, MovieRepository } from '../../repositories/movieRepository.js';

type MediaKind = keyof AutoSkipDefaults;

/** The auto-skip scope of a profile's default for one media type. */
export function defaultScopeKey(kind: MediaKind): string { return `default:${kind}`; }

/** A title with no media type counts as a movie. */
function kindOf(row: Pick<CreditsRow, 'mediaType'>): MediaKind { return row.mediaType === 'tv' ? 'tv' : 'movie'; }

/** The title-level override scope: a movie is its own, an episode shares its show's (a show key-less episode falls back to its id). */
export function titleScopeKey(row: Pick<CreditsRow, 'id' | 'mediaType' | 'showKey'>): string {
  return kindOf(row) === 'tv' && row.showKey ? row.showKey : `movie:${row.id}`;
}

/** The title's own credits start: the user's mark wins over a chapter. Never a learned value. */
function ownStart(row: Pick<CreditsRow, 'markMs' | 'chapterMs'>): Credits | null {
  if (row.markMs !== null) return { startMs: row.markMs, source: 'mark' };
  if (row.chapterMs !== null) return { startMs: row.chapterMs, source: 'chapter' };
  return null;
}

/** Where a title's credits start and whether a profile skips them. */
export class CreditsResolver {
  public constructor(private readonly movies: MovieRepository, private readonly choices: AutoSkipRepository) {}

  /** Mark, then chapter, then (episodes) the credits length of the sibling with the closest duration. */
  public credits(id: number): Credits | null {
    const row = this.movies.getCredits(id);
    if (!row) return null;
    return ownStart(row) ?? this.learned(row);
  }

  /** The title override, then the profile's default for the title's type, then the server default. */
  public autoSkip(id: number, profileId: number | undefined): boolean {
    const row = this.movies.getCredits(id);
    const kind = row ? kindOf(row) : 'movie';
    if (profileId === undefined) return creditsConfig.defaultAutoSkip[kind];
    const override = row ? this.choices.get(profileId, titleScopeKey(row)) : undefined;
    return override ?? this.defaults(profileId)[kind];
  }

  public defaults(profileId: number): AutoSkipDefaults {
    return {
      movie: this.choices.get(profileId, defaultScopeKey('movie')) ?? creditsConfig.defaultAutoSkip.movie,
      tv: this.choices.get(profileId, defaultScopeKey('tv')) ?? creditsConfig.defaultAutoSkip.tv
    };
  }

  private learned(row: CreditsRow): Credits | null {
    if (kindOf(row) !== 'tv' || !row.showKey || row.durationMs === null) return null;
    const ownDuration = row.durationMs;
    let best: { lengthMs: number; distance: number } | null = null;
    for (const sibling of this.movies.creditsOfShow(row.showKey)) {
      const start = ownStart(sibling);
      if (sibling.id === row.id || !start || sibling.durationMs === null || start.startMs >= sibling.durationMs) continue;
      const distance = Math.abs(sibling.durationMs - ownDuration);
      if (distance > creditsConfig.seriesDurationToleranceMs || (best && best.distance <= distance)) continue;
      best = { lengthMs: sibling.durationMs - start.startMs, distance };
    }
    if (!best || best.lengthMs >= ownDuration) return null;
    return { startMs: ownDuration - best.lengthMs, source: 'series' };
  }
}
