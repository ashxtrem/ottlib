import { constants } from 'node:fs';
import { copyFile, mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, extname, join } from 'node:path';
import type { SubtitleSource } from '@ottlib/shared';
import { subtitleFormats } from '../../config/subtitles.js';
import { DownloadedSubtitleRepository, type DownloadedSubtitle } from '../../repositories/downloadedSubtitleRepository.js';
import { isWithinRoot } from '../scanner/walker.js';
import type { ProviderSubtitle } from '../../providers/subtitles/SubtitleProvider.js';
import { decodeSubtitle } from './subtitleFile.js';

export const downloadedSubtitleOrder = 1_000_000;
export class SubtitleLibraryService {
  private readonly root: string;
  private readonly pending = new Map<string, Promise<{ subtitle: SubtitleSource; reused: boolean }>>();
  constructor(private readonly records: DownloadedSubtitleRepository, appDataPath: string, private readonly streamQuery: (id: number) => string = () => '') {
    this.root = join(appDataPath, 'subtitles');
  }
  source(record: DownloadedSubtitle): SubtitleSource {
    return {
      url: `/api/movies/${record.movie_id}/subtitles/${downloadedSubtitleOrder + record.id}${this.streamQuery(record.movie_id)}`,
      language: record.language, codec: subtitleFormats[record.format].codec,
      title: `${record.language.toUpperCase()} · ${record.provider} · ${record.release_name}`,
      isForced: Boolean(record.forced), isHearingImpaired: Boolean(record.hearing_impaired),
    };
  }
  async list(movieId: number): Promise<DownloadedSubtitle[]> {
    const valid = await Promise.all(this.records.list(movieId).map(async record => await this.exists(record) ? record : null));
    return valid.filter((record): record is DownloadedSubtitle => record !== null);
  }
  async file(movieId: number, order: number): Promise<{ path: string; mimeType: string }> {
    const record = this.records.get(movieId, order - downloadedSubtitleOrder);
    if (!record || !await this.exists(record)) throw new Error('Subtitle file is unavailable');
    return { path: record.path, mimeType: subtitleFormats[record.format].mimeType };
  }
  private async exists(record: DownloadedSubtitle): Promise<boolean> {
    if (!subtitleFormats[record.format] || !isWithinRoot(this.root, record.path)) return false;
    try { return (await stat(record.path)).isFile(); } catch { return false; }
  }
  save(movieId: number, moviePath: string, result: ProviderSubtitle, download: () => Promise<{ bytes: Buffer; filename: string }>): Promise<{ subtitle: SubtitleSource; reused: boolean }> {
    const key = `${movieId}:${result.provider}:${result.remoteId}`;
    const existing = this.pending.get(key); if (existing) return existing;
    const operation = this.store(movieId, moviePath, result, download).finally(() => this.pending.delete(key));
    this.pending.set(key, operation); return operation;
  }
  private async store(movieId: number, moviePath: string, result: ProviderSubtitle, download: () => Promise<{ bytes: Buffer; filename: string }>): Promise<{ subtitle: SubtitleSource; reused: boolean }> {
    const previous = this.records.find(movieId, result.provider, result.remoteId);
    if (previous && await this.exists(previous)) return { subtitle: this.source(previous), reused: true };
    const file = await download();
    const decoded = decodeSubtitle(file.bytes, file.filename, result.format);
    const identity = createHash('sha256').update(`${movieId}:${result.provider}:${result.remoteId}`).digest('hex');
    await mkdir(this.root, { recursive: true });
    const path = join(this.root, `${identity}.${decoded.format}`); const temporary = `${path}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, decoded.bytes, { flag: 'wx' }); await rename(temporary, path); }
    finally { await unlink(temporary).catch(() => undefined); }
    let sidecar: string | null = null;
    const stem = basename(moviePath, extname(moviePath));
    const sidecarPath = join(dirname(moviePath), `${stem}.${result.language}.${identity.slice(0, 8)}${result.forced ? '.forced' : ''}${result.hearingImpaired ? '.sdh' : ''}.${decoded.format}`);
    try { await copyFile(path, sidecarPath, constants.COPYFILE_EXCL); sidecar = sidecarPath; }
    catch { /* Managed storage also works when the media folder is read-only. */ }
    const record = this.records.save({ movie_id: movieId, provider: result.provider, remote_id: result.remoteId,
      language: result.language, release_name: result.releaseName, format: decoded.format, path, sidecar_path: sidecar,
      hearing_impaired: Number(result.hearingImpaired), forced: Number(result.forced) });
    return { subtitle: this.source(record), reused: false };
  }
}
