import { useState } from 'react';
import { focusRing } from './interactionStyles';

/** The id the search shortcut (`/`, Ctrl/Cmd+K) focuses. */
export const librarySearchInputId = 'library-search';

interface LibrarySearchInputProps {
  id?: string;
  value: string;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
  recentSearches?: string[];
  onRecentSearchRemove?: (term: string) => void;
  /** Enter was pressed, or a recent search was chosen. */
  onCommit?: (term: string) => void;
}

/** The search box. While it is focused and empty, the recent searches open under it. */
export function LibrarySearchInput({ id, value, label, placeholder, onChange, recentSearches = [], onRecentSearchRemove, onCommit }: LibrarySearchInputProps) {
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const listId = `${id ?? 'search'}-recent`;
  const showRecents = focused && !dismissed && value === '' && recentSearches.length > 0;
  return <div className="min-w-0 flex-1 md:relative" onFocus={() => { setFocused(true); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setFocused(false); setDismissed(false); } }}>
    <input id={id} value={value} onChange={(event) => { setDismissed(false); onChange(event.target.value); }} onKeyDown={(event) => { if (event.key === 'Escape' && showRecents) { event.stopPropagation(); setDismissed(true); } else if (event.key === 'Enter') onCommit?.(value); }} placeholder={placeholder} aria-label={label} aria-controls={showRecents ? listId : undefined} aria-expanded={recentSearches.length > 0 ? showRecents : undefined} autoComplete="off" className={`w-full min-w-0 rounded-lg border border-border bg-field px-4 py-2 ${focusRing}`} />
    {showRecents && <div id={listId} onMouseDown={(event) => event.preventDefault()} role="group" aria-label="Recent searches" className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
      <p className="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">Recent searches</p>
      <ul>{recentSearches.map((term) => <li key={term} className="flex items-center hover:bg-surface-raised">
        <button type="button" onClick={() => { onChange(term); onCommit?.(term); setDismissed(true); document.getElementById(id ?? '')?.focus(); }} className={`min-w-0 flex-1 truncate px-4 py-2 text-left text-sm ${focusRing}`}>{term}</button>
        {onRecentSearchRemove && <button type="button" onClick={() => onRecentSearchRemove(term)} aria-label={`Remove ${term} from recent searches`} title="Remove" className={`shrink-0 px-3 py-2 text-muted hover:text-foreground ${focusRing}`}><span aria-hidden="true">×</span></button>}
      </li>)}</ul>
    </div>}
  </div>;
}
