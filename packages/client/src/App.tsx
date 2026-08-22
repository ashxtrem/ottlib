import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { ScanStatusBanner } from './components/ScanStatusBanner';
import { LibraryPage } from './pages/LibraryPage';
import { MovieDetailPage } from './pages/MovieDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { ShelvesPage } from './pages/ShelvesPage';
import { ShelfDetailPage } from './pages/ShelfDetailPage';
import { BackIcon, PlusIcon, SettingsIcon, ShelvesIcon } from './components/icons';
import { useBackToLibrary } from './hooks/useBackToLibrary';

const floatingButtonClassName = 'inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent-soft/50 transition hover:scale-105 hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function FloatingNavigationButtons() {
  const { pathname } = useLocation();
  const backToLibrary = useBackToLibrary();
  const back = <button type="button" onClick={backToLibrary} aria-label="Back to library" title="Back to library" className={floatingButtonClassName}><BackIcon /><span className="sr-only">Back to library</span></button>;
  if (pathname === '/') return <div className="fixed bottom-5 right-5 z-20 flex flex-col gap-3"><Link to="/shelves" aria-label="Open shelves" title="Shelves" className={floatingButtonClassName}><ShelvesIcon /><span className="sr-only">Open shelves</span></Link><Link to="/settings" aria-label="Open settings" title="Settings" className={floatingButtonClassName}><SettingsIcon /><span className="sr-only">Open settings</span></Link></div>;
  if (pathname === '/shelves') return <div className="fixed bottom-5 right-5 z-20 flex gap-3"><Link to="/shelves?create=1" aria-label="Create shelf" title="Create shelf" className={floatingButtonClassName}><PlusIcon /><span className="sr-only">Create shelf</span></Link>{back}</div>;
  return <div className="fixed bottom-5 right-5 z-20">{back}</div>;
}

export function App() {
  return <div className="min-h-screen"><header className="sticky top-0 z-30 border-b border-border bg-canvas/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center"><Link to="/" className="rounded-full transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><img src="/icons/ottlib-192.png" alt="OttLib home" className="h-10 w-10" /></Link></div></header><ScanStatusBanner /><main className="mx-auto max-w-7xl px-4 py-6 pb-24"><Routes><Route path="/" element={<LibraryPage />} /><Route path="/movie/:id" element={<MovieDetailPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/shelves" element={<ShelvesPage />} /><Route path="/shelves/:id" element={<ShelfDetailPage />} /></Routes></main><FloatingNavigationButtons /></div>;
}
