import type { SVGProps } from 'react';

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" {...props}>{children}</svg>;
}

export function BackIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><path d="m15 18-6-6 6-6" /></Icon>;
}

export function ShelvesIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><path d="M4 6h16M4 12h16M4 18h16" /><path d="M7 4v4m5-4v4m5-4v4M7 10v4m5-4v4m5-4v4M7 16v4m5-4v4m5-4v4" /></Icon>;
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1.08 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1.08H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1.08-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1.08H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08Z" /></Icon>;
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>;
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></Icon>;
}

export function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><path d="M20 11a8 8 0 1 0 2 5.5" /><path d="M20 4v7h-7" /></Icon>;
}

export function DragHandleIcon(props: SVGProps<SVGSVGElement>) {
  return <Icon {...props}><path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" strokeWidth="3" /></Icon>;
}

export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" {...props}><path d="M7 4.5v15l13-7.5-13-7.5Z" /></svg>;
}
