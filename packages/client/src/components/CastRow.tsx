import { Link } from 'react-router-dom';
import type { CastMember } from '@ottlib/shared';
import { focusRing, liftable } from './interactionStyles';

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => word[0]?.toUpperCase() ?? '').join('');
}

/** Cast as photo cards in a sideways row; each opens the library filtered to that actor. */
export function CastRow({ members }: { members: CastMember[] }) {
  if (!members.length) return null;
  return <section aria-labelledby="cast-row-heading">
    <h2 id="cast-row-heading" className="text-xs font-semibold uppercase tracking-wide text-subtle">Cast</h2>
    <ul className="mt-2 flex gap-3 overflow-x-auto pb-2">{members.map((member) => <li key={member.name} className="w-24 shrink-0">
      <Link to={`/library?actor=${encodeURIComponent(member.name)}`} aria-label={`Browse actor ${member.name}`} className={`block rounded-xl ${focusRing}`}>
        <div className={`aspect-[2/3] overflow-hidden rounded-xl bg-surface-raised ring-1 ring-border hover:ring-accent ${liftable}`}>
          {member.photoUrl
            ? <img src={member.photoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            : <div aria-hidden="true" className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted">{initialsOf(member.name)}</div>}
        </div>
        <p className="mt-1.5 line-clamp-2 break-words text-xs font-medium text-foreground">{member.name}</p>
      </Link>
    </li>)}</ul>
  </section>;
}
