/** Identifies what "hide this title" means: a whole TV show, or a single movie. */
export interface Hideable { id: number; showKey: string | null }

export function hideKeyOf(item: Hideable): string {
  return item.showKey ?? `m:${item.id}`;
}

/** TV rows are titled "Show · S1E2 · Episode"; hiding applies to the show, so display just its name. */
export function hiddenDisplayTitle(title: string, showKey: string | null): string {
  if (!showKey) return title;
  const match = /\s·\sS\d+E\d+/.exec(title);
  return match ? title.slice(0, match.index) : title;
}
