import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentProfile, useDeselectProfile, useProfiles } from '../hooks/useProfile';
import { canSwitchProfile } from '../utils/profileRights';
import { ProfileAvatar } from './ProfileAvatar';
import { focusRing, pressable } from './interactionStyles';

const itemClassName = `block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-raised focus-visible:bg-surface-raised ${focusRing}`;

/** Header chip for the current profile, with "Switch profile" (back to the picker) and a link to manage profiles. */
export function ProfileMenu({ className = '' }: { className?: string }) {
  const profile = useCurrentProfile().data?.profile;
  const count = useProfiles().data?.length ?? 1;
  const deselect = useDeselectProfile();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);

  if (!profile) return null;
  return <div ref={root} className={`relative ${className}`} onBlur={(event) => { if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} title={`Profile: ${profile.name}`}
      className={`flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-1 text-sm font-medium hover:bg-surface-raised sm:pr-3 ${focusRing} ${pressable}`}>
      <ProfileAvatar name={profile.name} color={profile.color} />
      <span className="hidden max-w-[10rem] truncate sm:inline">{profile.name}</span>
      <span className="sr-only sm:hidden">Profile: {profile.name}</span>
    </button>
    {open && <div id={menuId} role="menu" aria-label="Profile" className="absolute right-0 top-full z-40 mt-2 w-56 animate-pop-in rounded-xl border border-border bg-surface p-1 shadow-lg">
      <p className="truncate px-3 py-2 text-xs text-muted">Watching as <span className="font-semibold text-foreground">{profile.name}</span></p>
      {canSwitchProfile(profile, count) && <button type="button" role="menuitem" disabled={deselect.isPending} onClick={() => deselect.mutate(undefined, { onSettled: () => setOpen(false) })} className={itemClassName}>{deselect.isPending ? 'Switching…' : 'Switch profile'}</button>}
      <Link to="/settings#profiles" role="menuitem" onClick={() => setOpen(false)} className={itemClassName}>Manage profiles</Link>
    </div>}
  </div>;
}
