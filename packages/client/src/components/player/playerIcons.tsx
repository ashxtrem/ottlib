import type { ReactNode } from 'react';

function Icon({ children, filled = false }: { children: ReactNode; filled?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

export const PlayGlyph = () => <Icon filled><path d="M7 4.5v15l13-7.5-13-7.5Z" /></Icon>;
export const PauseGlyph = () => <Icon filled><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></Icon>;
export const BackTenGlyph = () => <Icon><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fill="currentColor" stroke="none" fontWeight="700">10</text></Icon>;
export const ForwardTenGlyph = () => <Icon><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /><text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fill="currentColor" stroke="none" fontWeight="700">10</text></Icon>;
export const VolumeGlyph = () => <Icon><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></Icon>;
export const MutedGlyph = () => <Icon><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m22 9-6 6M16 9l6 6" /></Icon>;
export const SubtitlesGlyph = () => <Icon><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15h4M13 15h4M7 11h10" /></Icon>;
export const AudioGlyph = () => <Icon><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4ZM3 19a2 2 0 0 0 2 2h1v-6H3v4Z" /></Icon>;
export const FullscreenGlyph = () => <Icon><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></Icon>;
export const ExitFullscreenGlyph = () => <Icon><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></Icon>;
