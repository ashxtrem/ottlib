export interface TitleExtrasBackfillDeps {
  /** False when no metadata provider is configured: a refresh could not fetch anything. */
  hasMetadataProvider: () => boolean;
  idsMissingExtras: () => number[];
  /** The metadata refresh for just these ids; null when a metadata run is already active (it never joins that run). */
  startSelectedRefresh: (ids: number[]) => unknown | null;
  log?: (message: string) => void;
}

/**
 * Called once when the server starts: matched titles that never got their extras (cast photos, logo, trailer, collection,
 * ratings) are filled in by a metadata refresh over just those titles. Returns whether a refresh was started.
 */
export function startTitleExtrasBackfill(deps: TitleExtrasBackfillDeps): boolean {
  try {
    if (!deps.hasMetadataProvider()) { deps.log?.('Title extras backfill skipped: no metadata provider is configured.'); return false; }
    const ids = deps.idsMissingExtras();
    if (!ids.length) return false;
    if (deps.startSelectedRefresh(ids) === null) { deps.log?.('Title extras backfill skipped: a metadata run is already active.'); return false; }
    deps.log?.(`Title extras backfill started for ${ids.length} titles.`);
    return true;
  } catch (error) {
    deps.log?.(`Title extras backfill could not start: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
