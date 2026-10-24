import type { Movie } from '@ottlib/shared';
import { Link } from 'react-router-dom';
import { focusRing, pressable } from './interactionStyles';

export type PlayButtonVariant = 'primary' | 'compact';

const compactButtonClassName = `inline-flex h-10 w-10 items-center justify-center rounded-lg border border-accent bg-accent text-accent-foreground transition-[background-color,color,transform] duration-fast ease-emphasis hover:bg-accent-hover hover:text-accent-foreground ${focusRing} ${pressable}`;
const primaryButtonClassName = `inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-foreground transition-[background-color,transform] duration-fast ease-emphasis hover:bg-accent-hover ${focusRing} ${pressable}`;

export function androidIntent(streamUrl: string, title: string): string {
  const url = new URL(streamUrl);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.slice(0, -1)};type=video/*;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(streamUrl)};S.title=${encodeURIComponent(title)};end`;
}

export function supportsExternalPlaybackHandoff(userAgent: string): boolean {
  return /Android|OculusBrowser/i.test(userAgent);
}

/** h:mm:ss over an hour, else m:ss (41:20, 1:05:09). */
export function formatResumePosition(positionMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, positionMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

export function playLabel(resumePositionMs: number | null | undefined): string {
  return resumePositionMs && resumePositionMs >= 1000 ? `Resume ${formatResumePosition(resumePositionMs)}` : 'Play';
}

/** Opens the browser player at /watch/:id on every client; other players live in PlayMoreMenu. */
export function PlayButton({ movie, variant = 'primary' }: { movie: Movie; variant?: PlayButtonVariant }) {
  const label = playLabel(movie.resumePositionMs);
  const isPrimary = variant === 'primary';
  return <Link to={`/watch/${movie.id}`} title={label} aria-label={label} className={isPrimary ? primaryButtonClassName : compactButtonClassName}>
    <svg aria-hidden="true" className="h-5 w-5 translate-x-px" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7V5Z" /></svg>
    {isPrimary ? <span>{label}</span> : <span className="sr-only">{label}</span>}
  </Link>;
}
