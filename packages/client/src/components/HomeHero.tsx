import { formatRuntime } from '@ottlib/shared';
import { Link } from 'react-router-dom';
import type { HomeHeroData } from '../hooks/useHomeHero';
import { focusRing, pressable } from './interactionStyles';
import { SkeletonBlock } from './Skeleton';

const heroHeight = 'aspect-video md:aspect-auto md:h-[26rem]';
const buttonClassName = `inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-semibold md:w-auto ${focusRing} ${pressable}`;

/** "42 min left", "1 h 5 min left"; null when not resuming or the length is unknown. */
export function timeLeftLabel(resumePositionMs: number | null | undefined, durationMs: number | null | undefined): string | null {
  if (!resumePositionMs || resumePositionMs < 1000 || !durationMs || durationMs <= resumePositionMs) return null;
  const minutes = Math.max(1, Math.round((durationMs - resumePositionMs) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min left` : `${minutes} min left`;
}

/** The featured title above the Home rows: backdrop, logo or title, one meta line, overview, Resume/Play and Details. */
export function HomeHero({ hero }: { hero: HomeHeroData | null }) {
  if (!hero) return null;
  if (hero.isLoading) return <div aria-busy="true" aria-live="polite"><span className="sr-only">Loading featured title…</span><SkeletonBlock className={`w-full rounded-2xl ${heroHeight}`} /></div>;
  const { item, movie } = hero;
  const title = movie?.title ?? item.title;
  const runtimeMs = movie?.runtime ? movie.runtime * 60_000 : null;
  const durationMs = item.durationMs ?? movie?.mediaInfo?.durationMs ?? runtimeMs;
  const resumePositionMs = movie?.resumePositionMs ?? item.resumePositionMs;
  const timeLeft = timeLeftLabel(resumePositionMs, durationMs);
  const meta = [movie?.year ?? item.year, formatRuntime(movie?.runtime, durationMs), timeLeft].filter(Boolean).join(' · ');
  const playText = resumePositionMs && resumePositionMs >= 1000 ? 'Resume' : 'Play';
  return <section aria-label={`Featured: ${title}`} className="relative animate-fade-in overflow-hidden rounded-2xl bg-on-art-scrim text-on-art md:h-[26rem]">
    <div className="relative aspect-video md:absolute md:inset-0 md:aspect-auto">
      {movie?.backdropUrl && <img src={movie.backdropUrl} alt="" decoding="async" className="h-full w-full object-cover" />}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-on-art-scrim via-on-art-scrim/20 to-transparent md:bg-gradient-to-r md:from-on-art-scrim md:via-on-art-scrim/75 md:to-transparent" />
    </div>
    <div className="relative -mt-10 space-y-3 px-4 pb-4 md:mt-0 md:flex md:h-full md:w-1/2 md:flex-col md:justify-end md:p-8 lg:w-1/3">
      <h2 className="text-2xl font-bold leading-tight md:text-4xl">
        {movie?.logoUrl ? <img src={movie.logoUrl} alt={title} className="max-h-16 max-w-full object-contain object-left md:max-h-24" /> : title}
      </h2>
      {meta && <p className="text-sm text-on-art-muted">{meta}</p>}
      {movie?.overview && <p className="line-clamp-2 text-sm text-on-art-muted md:line-clamp-3 md:text-base">{movie.overview}</p>}
      <div className="flex flex-col gap-2 pt-1 md:flex-row">
        <Link to={`/watch/${item.id}`} className={`${buttonClassName} bg-accent text-accent-foreground transition-[background-color,transform] duration-fast ease-emphasis hover:bg-accent-hover`}>
          <svg aria-hidden="true" className="h-5 w-5 translate-x-px" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7V5Z" /></svg>
          <span>{playText}</span>
        </Link>
        <Link to={`/movie/${item.id}`} className={`${buttonClassName} border border-on-art/40 bg-on-art/10 text-on-art transition-[background-color,transform] duration-fast ease-emphasis hover:bg-on-art/20`}>Details</Link>
      </div>
    </div>
  </section>;
}
