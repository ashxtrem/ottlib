import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ProfileSummary } from '@ottlib/shared';
import { useProfiles, useSelectProfile } from '../hooks/useProfile';
import { getLastProfileId } from '../hooks/profileSession';
import { columnsFromTops, initialTileIndex, nextTileIndex } from '../utils/tileFocus';
import { pinErrorMessage } from '../utils/pinInput';
import { ProfileAvatar } from './ProfileAvatar';
import { PinPad } from './PinPad';
import { LockIcon } from './icons';
import { focusRing, pressable } from './interactionStyles';

/** Full-screen "Who's watching?" tiles. PIN-less profiles open at once; locked ones ask for their PIN first. */
export function ProfilePicker() {
  const profiles = useProfiles();
  const select = useSelectProfile();
  const [locked, setLocked] = useState<ProfileSummary | null>(null);
  const pick = (profile: ProfileSummary) => {
    select.reset();
    if (profile.hasPin) setLocked(profile);
    else select.mutate({ id: profile.id });
  };
  const pickError = !locked && select.error ? pinErrorMessage(select.error) : null;

  return <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
    <img src="/icons/ottlib-192.png" alt="" className="h-12 w-12" />
    <h1 className="mt-4 text-center text-2xl font-bold sm:text-3xl">Who’s watching?</h1>
    {profiles.isError && <div role="alert" className="mt-8 text-center"><p className="text-sm text-muted">Couldn’t load profiles. {profiles.error.message}</p><button type="button" autoFocus onClick={() => void profiles.refetch()} className={`mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover ${focusRing} ${pressable}`}>Try again</button></div>}
    {profiles.data && <ProfileTiles profiles={profiles.data} pendingId={select.isPending ? select.variables?.id : undefined} onPick={pick} />}
    {pickError && <p role="alert" className="mt-6 text-sm text-error">{pickError}</p>}
    <PinPad open={locked !== null} title={locked ? `Enter PIN for ${locked.name}` : ''} pending={select.isPending}
      error={select.error ? pinErrorMessage(select.error) : null}
      onSubmit={(pin) => { if (locked) select.mutate({ id: locked.id, pin }); }}
      onClose={() => { setLocked(null); select.reset(); }} />
  </main>;
}

function ProfileTiles({ profiles, pendingId, onPick }: { profiles: ProfileSummary[]; pendingId?: number; onPick: (profile: ProfileSummary) => void }) {
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    tiles.current[initialTileIndex(profiles.map((profile) => profile.id), getLastProfileId())]?.focus();
  }, [profiles]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const buttons = tiles.current.filter((tile): tile is HTMLButtonElement => tile !== null);
    const next = nextTileIndex(index, event.key, buttons.length, columnsFromTops(buttons.map((tile) => tile.offsetTop)));
    if (next === null) return;
    event.preventDefault();
    buttons[next].focus();
  };

  return <ul className="mt-8 flex max-w-3xl flex-wrap justify-center gap-4 sm:gap-6">
    {profiles.map((profile, index) => <li key={profile.id}>
      <button type="button" ref={(element) => { tiles.current[index] = element; }} onClick={() => onPick(profile)} onKeyDown={(event) => onKeyDown(event, index)} disabled={pendingId !== undefined}
        aria-label={profile.hasPin ? `${profile.name}, locked with a PIN` : profile.name}
        className={`group flex w-28 flex-col items-center gap-2 rounded-2xl p-3 transition-[background-color,transform] duration-fast ease-emphasis hover:bg-surface-raised focus-visible:scale-105 focus-visible:bg-surface-raised disabled:opacity-60 sm:w-36 ${focusRing} ${pressable}`}>
        <span className="relative">
          <ProfileAvatar name={profile.name} color={profile.color} className={`h-20 w-20 text-3xl sm:h-28 sm:w-28 sm:text-4xl ${pendingId === profile.id ? 'animate-pulse' : ''}`} />
          {profile.hasPin && <span className="absolute -bottom-1 -right-1 rounded-full border border-border bg-surface p-1 text-muted"><LockIcon className="h-4 w-4" /></span>}
        </span>
        <span className="max-w-full truncate text-sm font-medium text-muted group-hover:text-foreground group-focus-visible:text-foreground sm:text-base">{profile.name}</span>
      </button>
    </li>)}
  </ul>;
}
