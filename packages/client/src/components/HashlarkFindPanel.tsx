import { Link } from 'react-router-dom';
import { focusRing, pressable } from './interactionStyles';
import { FindButton } from './FindButton';

/** Shown on the torrent search and upgrade finder pages while Find hands titles to Hashlark instead. */
export function HashlarkFindPanel() {
  return <section aria-labelledby="hashlark-find-heading" className="rounded-xl border border-dashed border-border p-6 text-center md:p-12">
    <h1 id="hashlark-find-heading" className="text-lg font-semibold">Find is set to Hashlark</h1>
    <p className="mt-2 text-sm text-muted">Find buttons open the Hashlark app on the server PC, so OttLib's own torrent search is off. Switch back to qBittorrent under Settings → Find and torrent search.</p>
    <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
      <FindButton mode="hashlark" label="Open Hashlark" className={`inline-flex justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover ${pressable} ${focusRing}`} />
      <Link to="/settings" className={`inline-flex justify-center rounded-lg border border-border-strong px-4 py-2 text-sm font-medium hover:bg-surface-raised ${focusRing}`}>Open settings</Link>
    </div>
  </section>;
}
