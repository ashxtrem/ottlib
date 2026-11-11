import { useFindStatus } from '../hooks/useFindStatus';
import { FindButton } from './FindButton';
import { focusRing, pressable } from './interactionStyles';

/** Hashlark on the server PC: whether its link is registered, and a button to open it once Hashlark mode is saved. */
export function HashlarkSettingsSection({ saved }: { saved: boolean }) {
  const status = useFindStatus();
  const available = status.data?.hashlarkAvailable;
  const buttonClassName = `inline-flex justify-center rounded-lg border border-border-strong px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-fast ease-emphasis hover:bg-surface-raised ${focusRing} ${pressable}`;
  return <div role="group" aria-label="Hashlark settings" className="mt-4 space-y-3">
    <p className="text-sm text-muted">Find buttons on every device open Hashlark on the server PC with the title filled in. Nothing else to set up here.</p>
    <p role="status" className={`text-sm ${available === undefined ? 'text-muted' : available ? 'text-success' : 'text-warning'}`}>
      {status.isLoading ? 'Checking for Hashlark…' : status.error ? status.error.message : available ? 'Hashlark found on the server PC' : 'Not found. Install Hashlark on the server PC.'}
    </p>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      {saved ? <FindButton mode="hashlark" label="Open Hashlark" className={buttonClassName} /> : <button type="button" disabled className={`${buttonClassName} cursor-not-allowed opacity-60`}>Open Hashlark</button>}
      {!saved && <span className="text-xs text-muted">Save settings to use Hashlark first.</span>}
    </div>
  </div>;
}
