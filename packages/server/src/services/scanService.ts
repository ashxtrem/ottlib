import { resolve } from 'node:path';
import { FolderRepository } from '../repositories/folderRepository.js';
import { MovieRepository } from '../repositories/movieRepository.js';
import { ScanRunRepository } from '../repositories/scanRunRepository.js';
import { SettingRepository } from '../repositories/settingRepository.js';
import type { ScanRun } from '@ottlib/shared';
import { MetadataMatchService } from './metadataMatchService.js';
import { MediaInfoService } from './mediaInfoService.js';
import { parseTitle } from './scanner/titleParser.js';
import { walkMovies } from './scanner/walker.js';

export class ScanService {
  public constructor(private readonly folders: FolderRepository, private readonly movies: MovieRepository, private readonly runs: ScanRunRepository, private readonly settings: SettingRepository, private readonly matcher: MetadataMatchService, private readonly mediaInfo: MediaInfoService) {}

  public start(): ScanRun {
    const active = this.runs.active(); if (active) return active;
    const run = this.runs.create(); void this.execute(run.id); return run;
  }

  private async execute(runId: number): Promise<void> {
    let found = 0; let processed = 0; let titlesAdded = 0; const errors: string[] = [];
    const settings = this.settings.get();
    for (const folder of this.folders.list().filter((item) => item.enabled)) {
      const seenAt = new Date().toISOString(); let completed = false;
      try {
        for await (const candidate of walkMovies(folder.path, settings.extensions, settings.ignoredPatterns, settings.excludedFolders)) {
          found += 1; const parsed = parseTitle(candidate.path);
          const result = this.movies.upsertScanned({ folderId: folder.id, path: resolve(candidate.path), filename: candidate.filename, title: parsed.title, year: parsed.year, size: candidate.size, mtimeMs: candidate.mtimeMs, seenAt });
          processed += 1; if (result.inserted) titlesAdded += 1; this.runs.progress(runId, found, processed, titlesAdded);
          if (result.needsProbe) await this.mediaInfo.refresh(result.id, candidate.path);
          if (result.needsMatch) await this.matcher.suggest(result.id, undefined, { autoAccept: true });
        }
        completed = true;
      } catch (error) { errors.push(`${folder.path}: ${error instanceof Error ? error.message : 'scan failed'}`); }
      if (completed) this.movies.markMissingNotSeen(folder.id, seenAt);
    }
    this.runs.finish(runId, errors.length ? 'failed' : 'completed', errors.length ? errors.join('\n') : null);
  }
}
