import type { PlaybackProgressResult, PlaybackProgressUpdate } from '@ottlib/shared';
import { playbackProgressRules } from '../config/defaults.js';
import { PlaybackProgressRepository } from '../repositories/playbackProgressRepository.js';
import { WatchStateRepository } from '../repositories/watchStateRepository.js';
import { NextPlaybackService } from './nextPlaybackService.js';

export class PlaybackProgressService {
  public constructor(private readonly progress: PlaybackProgressRepository, private readonly watches: WatchStateRepository, private readonly nextPlayback?: NextPlaybackService) {}

  public record(movieId: number, deviceId: string, update: PlaybackProgressUpdate): PlaybackProgressResult {
    const positionMs = Math.min(update.positionMs, update.durationMs);
    if (positionMs >= update.durationMs * playbackProgressRules.watchedFraction) {
      this.complete(movieId, deviceId, update.shelfId);
      return { resumePositionMs: null, watched: true };
    }
    if (positionMs < playbackProgressRules.minimumPositionMs) {
      const existing = this.progress.get(movieId, deviceId);
      const collection = this.nextPlayback?.collectionId(movieId, deviceId, update.shelfId);
      if (existing?.positionMs === 0 || collection !== undefined) this.progress.set(movieId, deviceId, 0, update.durationMs, collection);
      else this.progress.clear(movieId, deviceId);
    }
    else this.progress.set(movieId, deviceId, positionMs, update.durationMs, this.nextPlayback?.collectionId(movieId, deviceId, update.shelfId));
    return { resumePositionMs: this.progress.get(movieId, deviceId)?.positionMs ?? null, watched: this.watches.get(movieId, deviceId) };
  }

  public clear(movieId: number, deviceId: string): void { this.progress.clear(movieId, deviceId); }

  public complete(movieId: number, deviceId: string, shelfId?: number): void {
    this.progress.transaction(() => {
      const collectionId = this.nextPlayback?.collectionId(movieId, deviceId, shelfId);
      const next = this.nextPlayback?.next(movieId, deviceId, collectionId);
      this.setWatched(movieId, deviceId, true);
      if (collectionId !== undefined) this.watches.setCollection(movieId, deviceId, collectionId);
      if (next && !next.watched) this.progress.queue(next.id, deviceId, next.mediaInfo?.durationMs ?? 1, next.mediaType === 'tv' ? undefined : collectionId);
    });
  }

  /** Marking a title watched also removes it from "continue watching". */
  public setWatched(movieId: number, deviceId: string, watched: boolean): void {
    this.watches.set(movieId, deviceId, watched);
    if (watched) this.progress.clear(movieId, deviceId);
  }
}
