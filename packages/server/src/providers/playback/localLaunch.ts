import { spawn } from 'node:child_process';
import type { PlaybackMovie } from '../../repositories/movieRepository.js';
import type { LocalPlaybackHandoff } from './PlaybackHandoff.js';

export class LocalLaunch implements LocalPlaybackHandoff {
  public readonly name = 'local-launch';
  public open(movie: PlaybackMovie): void {
    if (process.platform === 'win32') spawn('cmd.exe', ['/d', '/s', '/c', 'start', '""', movie.path], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    else spawn('xdg-open', [movie.path], { detached: true, stdio: 'ignore' }).unref();
  }
  public reveal(movie: PlaybackMovie): void {
    if (process.platform === 'win32') spawn('explorer.exe', [`/select,"${movie.path}"`], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
  }
}
