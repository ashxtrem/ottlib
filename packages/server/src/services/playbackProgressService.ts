import type { PlaybackProgressResult, PlaybackProgressUpdate } from '@ottlib/shared';
import { playbackProgressRules } from '../config/defaults.js';
import { PlaybackProgressRepository } from '../repositories/playbackProgressRepository.js';
import { WatchStateRepository } from '../repositories/watchStateRepository.js';
import type { NextPlaybackService } from './nextPlaybackService.js';
import type { PlaybackHistoryService } from './playbackHistoryService.js';
import type { Viewer } from './viewer.js';

/** Progress and watched marks belong to the viewer's profile; the viewer's device is kept as the last device. */
export class PlaybackProgressService {
  public constructor(private readonly progress: PlaybackProgressRepository, private readonly watches: WatchStateRepository, private readonly nextPlayback?: NextPlaybackService, private readonly history?: PlaybackHistoryService) {}

  public record(movieId: number, viewer: Viewer, update: PlaybackProgressUpdate): PlaybackProgressResult {
    const { profileId, deviceId } = viewer;
    const positionMs = Math.min(update.positionMs, update.durationMs);
    const resumedFromMs = this.progress.get(movieId, profileId)?.positionMs ?? 0;
    if (positionMs >= update.durationMs * playbackProgressRules.watchedFraction) {
      this.completeTitle(movieId, viewer, update.shelfId);
      this.history?.progressSaved(viewer, movieId, { positionMs, completed: true, resumedFromMs });
      return { resumePositionMs: null, watched: true };
    }
    if (positionMs < playbackProgressRules.minimumPositionMs) {
      const existing = this.progress.get(movieId, profileId);
      const collection = this.nextPlayback?.collectionId(movieId, profileId, update.shelfId);
      if (existing?.positionMs === 0 || collection !== undefined) this.progress.set(movieId, profileId, deviceId, 0, update.durationMs, collection);
      else this.progress.clear(movieId, profileId);
    }
    else this.progress.set(movieId, profileId, deviceId, positionMs, update.durationMs, this.nextPlayback?.collectionId(movieId, profileId, update.shelfId));
    this.history?.progressSaved(viewer, movieId, { positionMs, completed: false, resumedFromMs });
    return { resumePositionMs: this.progress.get(movieId, profileId)?.positionMs ?? null, watched: this.watches.get(movieId, profileId) };
  }

  public clear(movieId: number, profileId: number): void { this.progress.clear(movieId, profileId); }

  /** The player says the title finished, without a position. */
  public complete(movieId: number, viewer: Viewer, shelfId?: number): void {
    const resumedFromMs = this.progress.get(movieId, viewer.profileId)?.positionMs ?? 0;
    this.completeTitle(movieId, viewer, shelfId);
    this.history?.progressSaved(viewer, movieId, { positionMs: null, completed: true, resumedFromMs });
  }

  /** Marking a title watched also removes it from "continue watching". */
  public setWatched(movieId: number, viewer: Viewer, watched: boolean): void {
    this.watches.set(movieId, viewer.profileId, watched, viewer.deviceId);
    if (watched) this.progress.clear(movieId, viewer.profileId);
  }

  private completeTitle(movieId: number, viewer: Viewer, shelfId?: number): void {
    const { profileId, deviceId } = viewer;
    this.progress.transaction(() => {
      const collectionId = this.nextPlayback?.collectionId(movieId, profileId, shelfId);
      const next = this.nextPlayback?.next(movieId, profileId, collectionId);
      this.setWatched(movieId, viewer, true);
      if (collectionId !== undefined) this.watches.setCollection(movieId, profileId, collectionId);
      if (next && !next.watched) this.progress.queue(next.id, profileId, deviceId, next.mediaInfo?.durationMs ?? 1, next.mediaType === 'tv' ? undefined : collectionId);
    });
  }
}
