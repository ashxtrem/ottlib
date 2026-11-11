import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { FindMode } from '@ottlib/shared';
import { findHandoffRequest, useFindHandoff, type FindQuery } from '../hooks/useFindHandoff';

export function torrentSearchHref(title: string, year?: number | null): string {
  return `/torrents?q=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`;
}

interface FindButtonProps {
  mode: FindMode;
  /** The title to find; without one, qBittorrent mode opens the search page and Hashlark mode just opens the app. */
  query?: FindQuery;
  /** Visible text. A button with no title reads "Open Hashlark" in Hashlark mode. */
  label: string;
  ariaLabel?: string;
  /** Tooltip; defaults to none for text buttons and to the label for icon buttons. */
  title?: string;
  /** Renders an icon-only button with the label for screen readers. */
  icon?: ReactNode;
  className: string;
  viewTransition?: boolean;
}

/** The Find entry point: nothing while Find is off, a link to the in-app torrent search, or a hand-off to Hashlark on the server PC. */
export function FindButton({ mode, query, label, ariaLabel, title, icon, className, viewTransition }: FindButtonProps) {
  if (mode === 'off') return null;
  const opensApp = mode === 'hashlark' && !query;
  const text = opensApp ? 'Open Hashlark' : label;
  const accessibleLabel = (opensApp ? undefined : ariaLabel) ?? (icon ? text : undefined);
  const tooltip = icon ? (mode === 'hashlark' ? text : title ?? text) : undefined;
  const content = icon ? <>{icon}<span className="sr-only">{text}</span></> : text;
  if (mode === 'qbittorrent') return <Link to={query ? torrentSearchHref(query.title, query.year) : '/torrents'} viewTransition={viewTransition} aria-label={accessibleLabel} title={tooltip} className={className}>{content}</Link>;
  return <HashlarkFindButton query={query} ariaLabel={accessibleLabel} title={tooltip} className={className}>{content}</HashlarkFindButton>;
}

function HashlarkFindButton({ query, ariaLabel, title, className, children }: { query?: FindQuery; ariaLabel?: string; title?: string; className: string; children: ReactNode }) {
  const handoff = useFindHandoff();
  return <button type="button" onClick={() => handoff.mutate(findHandoffRequest(query))} disabled={handoff.isPending} aria-busy={handoff.isPending || undefined} aria-label={ariaLabel} title={title} className={`${className} disabled:cursor-wait disabled:opacity-70`}>{children}</button>;
}
