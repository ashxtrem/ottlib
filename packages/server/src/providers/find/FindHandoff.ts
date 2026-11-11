import type { FindHandoffRequest } from '@ottlib/shared';

/** What a Find hand-off needs: a title (and its year) to search for, and the IMDb id when the title has one. */
export type FindQuery = FindHandoffRequest;

/** A desktop app Find can hand a search to (Hashlark today). One file per app; the service picks by name. */
export interface FindHandoff {
  name: string;
  /** True when the app is installed on this machine. */
  available(): boolean;
  /** Opens the app on the search. Throws if the app can't be started. */
  open(query: FindQuery): void;
}
