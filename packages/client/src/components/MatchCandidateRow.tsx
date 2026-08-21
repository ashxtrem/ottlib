import { useState } from 'react';
import type { MatchCandidate } from '@ottlib/shared';

function detectSeasonEpisode(filename: string): { season: number; episode: number } | null {
  const match = filename.match(/s(\d{1,2})[\s._-]?e(\d{1,3})/i) ?? filename.match(/\b(\d{1,2})x(\d{2,3})\b/i);
  return match ? { season: Number(match[1]), episode: Number(match[2]) } : null;
}

export function MatchCandidateRow({ candidate, rawFilename, onAccept, pending }: {
  candidate: MatchCandidate; rawFilename: string; onAccept: (season?: number, episode?: number) => void; pending: boolean;
}) {
  const detected = candidate.mediaType === 'tv' ? detectSeasonEpisode(rawFilename) : null;
  const [season, setSeason] = useState(detected?.season ?? 1);
  const [episode, setEpisode] = useState(detected?.episode ?? 1);
  return <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-field px-4 py-3">
    <div><span className="font-medium">{candidate.title}</span> <span className="text-muted">{candidate.year ?? '—'}</span>
      <span className="ml-2 rounded bg-surface-raised px-1.5 py-0.5 text-xs uppercase text-muted">{candidate.mediaType === 'tv' ? 'TV Show' : 'Movie'}</span>
      <span className="ml-2 text-xs uppercase text-subtle">{candidate.provider} · {Math.round(candidate.score * 100)}% confidence</span>
    </div>
    <div className="flex items-center gap-2">
      {candidate.mediaType === 'tv' && <>
        <label className="text-xs text-muted">S<input type="number" min={1} value={season} onChange={(event) => setSeason(Number(event.target.value) || 1)} className="ml-1 w-14 rounded border border-border bg-surface px-1 py-0.5 text-foreground" /></label>
        <label className="text-xs text-muted">E<input type="number" min={1} value={episode} onChange={(event) => setEpisode(Number(event.target.value) || 1)} className="ml-1 w-14 rounded border border-border bg-surface px-1 py-0.5 text-foreground" /></label>
      </>}
      <button onClick={() => onAccept(candidate.mediaType === 'tv' ? season : undefined, candidate.mediaType === 'tv' ? episode : undefined)} disabled={pending} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">Accept</button>
    </div>
  </li>;
}
