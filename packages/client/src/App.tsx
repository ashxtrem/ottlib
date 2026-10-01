import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { ScanStatusBanner } from './components/ScanStatusBanner';
import { LibraryPage } from './pages/LibraryPage';
import { MovieDetailPage } from './pages/MovieDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { ShelvesPage } from './pages/ShelvesPage';
import { ShelfDetailPage } from './pages/ShelfDetailPage';
import { TorrentSearchPage } from './pages/TorrentSearchPage';
import { BackIcon, DownloadIcon, PlusIcon, SettingsIcon, ShelvesIcon } from './components/icons';
import { useBackToLibrary, useBackToLibraryLabel } from './hooks/useBackToLibrary';
import { focusRing, pressable } from './components/interactionStyles';
import { PinGate } from './components/PinGate';
import { useTorrentSearchEnabled } from './hooks/useTorrentSearchEnabled';

const floatingButtonClassName = `inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent-soft/50 transition-[background-color,transform] duration-fast ease-emphasis hover:scale-105 hover:bg-accent-hover ${focusRing} ${pressable}`;

function FloatingNavigationButtons() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const backToLibrary = useBackToLibrary();
  const backToLibraryLabel = useBackToLibraryLabel();
  const torrentSearchEnabled = useTorrentSearchEnabled();
  const isShelfDetail = /^\/shelves\/\d+$/.test(pathname);
  const onBack = isShelfDetail ? () => navigate('/shelves') : backToLibrary;
  const backLabel = isShelfDetail ? 'Back to shelves' : backToLibraryLabel;
  const back = <button type="button" onClick={onBack} aria-label={backLabel} title={backLabel} className={`${floatingButtonClassName} animate-pop-in`}><BackIcon /><span className="sr-only">{backLabel}</span></button>;
  if (pathname === '/') return <div key={pathname} className="fixed bottom-5 right-5 z-20 flex flex-col gap-3">{torrentSearchEnabled && <Link to="/torrents" viewTransition aria-label="Search torrents" title="Torrent search" className={`${floatingButtonClassName} animate-pop-in [animation-delay:80ms]`}><DownloadIcon /><span className="sr-only">Search torrents</span></Link>}<Link to="/shelves" viewTransition aria-label="Open shelves" title="Shelves" className={`${floatingButtonClassName} animate-pop-in [animation-delay:40ms]`}><ShelvesIcon /><span className="sr-only">Open shelves</span></Link><Link to="/settings" viewTransition aria-label="Open settings" title="Settings" className={`${floatingButtonClassName} animate-pop-in`}><SettingsIcon /><span className="sr-only">Open settings</span></Link></div>;
  if (pathname === '/shelves') return <div key={pathname} className="fixed bottom-5 right-5 z-20 flex gap-3"><Link to="/shelves?create=1" viewTransition aria-label="Create shelf" title="Create shelf" className={`${floatingButtonClassName} animate-pop-in [animation-delay:40ms]`}><PlusIcon /><span className="sr-only">Create shelf</span></Link>{back}</div>;
  return <div key={pathname} className="fixed bottom-5 right-5 z-20">{back}</div>;
}

export function App() {
  const { pathname } = useLocation();
  const scrollSentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = scrollSentinel.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { threshold: 1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);
  const isLibrary = pathname === '/';
  const hasMediaToolbar = isLibrary || /^\/shelves\/\d+$/.test(pathname);
  return <PinGate><div className="min-h-screen"><div ref={scrollSentinel} className="h-px" aria-hidden="true" /><header className={`sticky top-0 z-30 bg-canvas/95 px-4 py-3 transition-[border-color,box-shadow] duration-fast ease-standard ${scrolled ? 'border-b border-border shadow-sm' : 'border-b border-transparent'}`}><div className={`mx-auto flex max-w-7xl items-center ${hasMediaToolbar ? 'gap-3' : ''}`}><Link to="/" viewTransition className={`shrink-0 rounded-full transition-transform duration-fast ease-emphasis hover:scale-105 ${focusRing}`}><img src="/icons/ottlib-192.png" alt="OttLib home" className="h-10 w-10" /></Link>{hasMediaToolbar && <div id="library-toolbar" className="min-w-0 flex-1" />}</div></header><ScanStatusBanner /><main className="mx-auto max-w-7xl px-4 py-6 pb-24"><Routes><Route path="/" element={<LibraryPage />} /><Route path="/movie/:id" element={<MovieDetailPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/torrents" element={<TorrentSearchPage />} /><Route path="/shelves" element={<ShelvesPage />} /><Route path="/shelves/:id" element={<ShelfDetailPage />} /></Routes></main><FloatingNavigationButtons /></div></PinGate>;
}
