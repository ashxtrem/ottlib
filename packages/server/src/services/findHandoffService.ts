import { findMode, type FindHandoffRequest, type FindHandoffResult, type FindStatus, type Settings } from '@ottlib/shared';
import { hashlarkNotInstalledMessage } from '../config/hashlark.js';
import type { FindHandoff } from '../providers/find/FindHandoff.js';

export class FindError extends Error {
  public constructor(public readonly code: 'HASHLARK_NOT_FOUND', message: string) { super(message); this.name = 'FindError'; }
}

/** Hands a Find search to the desktop app on the server PC (Hashlark). The route only reaches `send` in Hashlark mode. */
export class FindHandoffService {
  public constructor(private readonly handoff: FindHandoff, private readonly settings: () => Pick<Settings, 'torrentSearchEnabled' | 'findProvider'>) {}

  public mode(): FindStatus['mode'] { return findMode(this.settings()); }

  public status(): FindStatus {
    const mode = this.mode();
    return { mode, hashlarkAvailable: this.handoff.available() };
  }

  public send(request: FindHandoffRequest): FindHandoffResult {
    if (!this.handoff.available()) throw new FindError('HASHLARK_NOT_FOUND', hashlarkNotInstalledMessage);
    this.handoff.open(request);
    return { app: 'hashlark' };
  }
}
