import { spawn as nodeSpawn, type SpawnOptions } from 'node:child_process';
import type { PlaybackMovie } from '../../repositories/movieRepository.js';
import type { LocalPlaybackHandoff } from './PlaybackHandoff.js';
import { VlcLocator } from './vlcLocator.js';

export type Spawner = (command: string, args: string[], options: SpawnOptions) => { unref(): void };

export class LocalLaunch implements LocalPlaybackHandoff {
  public readonly name = 'local-launch';
  public constructor(private readonly vlc = new VlcLocator(), private readonly spawn: Spawner = nodeSpawn) {}

  public hasVlc(): boolean { return this.vlc.find() !== null; }

  public open(movie: PlaybackMovie, startSec = 0): void {
    const vlc = this.vlc.find();
    if (vlc) { this.spawn(vlc, [...(startSec > 0 ? [`--start-time=${startSec}`] : []), movie.path], { detached: true, stdio: 'ignore' }).unref(); return; }
    if (process.platform === 'win32') this.spawn('cmd.exe', ['/d', '/s', '/c', 'start', '""', movie.path], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    else this.spawn('xdg-open', [movie.path], { detached: true, stdio: 'ignore' }).unref();
  }
  public reveal(movie: PlaybackMovie): void {
    if (process.platform === 'win32') this.spawn('explorer.exe', [`/select,"${movie.path}"`], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
  }
}
