import type { PlaybackMovie } from '../../repositories/movieRepository.js';
import type { PlaybackHandoff } from './PlaybackHandoff.js';

export class AndroidIntent implements PlaybackHandoff {
  public readonly name = 'android-intent';
  public create(streamUrl: string, movie: PlaybackMovie): string {
    const url = new URL(streamUrl); const fallback = encodeURIComponent(streamUrl);
    return `intent://${url.host}${url.pathname}#Intent;scheme=${url.protocol.slice(0, -1)};type=video/*;action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};S.title=${encodeURIComponent(movie.filename)};end`;
  }
}
