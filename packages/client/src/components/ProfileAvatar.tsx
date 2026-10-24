import { profileInitial } from '../utils/profileRights';

/** A profile's color circle with the first letter of its name. Size comes from `className` (e.g. h-8 w-8 text-sm). */
export function ProfileAvatar({ name, color, className = 'h-8 w-8 text-sm' }: { name: string; color: string; className?: string }) {
  return <span aria-hidden="true" style={{ backgroundColor: color }} className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white shadow-inner ${className}`}>{profileInitial(name)}</span>;
}
