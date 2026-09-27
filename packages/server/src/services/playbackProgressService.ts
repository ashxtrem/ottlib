import type { PlaybackProgressResult, PlaybackProgressUpdate } from '@ottlib/shared';
import { playbackProgressRules } from '../config/defaults.js';
import { PlaybackProgressRepository } from '../repositories/playbackProgressRepository.js';
import { WatchStateRepository } from '../repositories/watchStateRepository.js';

export class PlaybackProgressService {
  public constructor(private readonly progress: PlaybackProgressRepository, private readonly watches: WatchStateRepository) {}

  public record(movieId: number, deviceId: string, update: PlaybackProgressUpdate): PlaybackProgressResult {
    const positionMs = Math.min(update.positionMs, update.durationMs);
    if (positionMs >= update.durationMs * playbackProgressRules.watchedFraction) {
      this.setWatched(movieId, deviceId, true);
      return { resumePositionMs: null, watched: true };
    }
    if (positionMs < playbackProgressRules.minimumPositionMs) this.progress.clear(movieId, deviceId);
    else this.progress.set(movieId, deviceId, positionMs, update.durationMs);
    return { resumePositionMs: this.progress.get(movieId, deviceId)?.positionMs ?? null, watched: this.watches.get(movieId, deviceId) };
  }

  public clear(movieId: number, deviceId: string): void { this.progress.clear(movieId, deviceId); }

  /** Marking a title watched also removes it from "continue watching". */
  public setWatched(movieId: number, deviceId: string, watched: boolean): void {
    this.watches.set(movieId, deviceId, watched);
    if (watched) this.progress.clear(movieId, deviceId);
  }
}
