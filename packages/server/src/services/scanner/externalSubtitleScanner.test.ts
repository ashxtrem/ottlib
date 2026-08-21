import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findExternalSubtitleTracks } from './externalSubtitleScanner.js';

const directories: string[] = [];

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('findExternalSubtitleTracks', () => {
  it('finds associated sidecar subtitles and preserves their flags', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ottlib-subs-')); directories.push(directory);
    const movie = join(directory, 'Arrival.2016.2160p.WEB-DL.mkv');
    writeFileSync(movie, '');
    writeFileSync(join(directory, 'Arrival.2016.eng.forced.srt'), '');
    writeFileSync(join(directory, 'Arrival.2016.hin.sdh.ass'), '');
    writeFileSync(join(directory, 'Another.Movie.eng.srt'), '');

    await expect(findExternalSubtitleTracks(movie)).resolves.toMatchObject([
      { type: 'subtitle', source: 'external', language: 'eng', codec: 'SRT', isForced: true },
      { type: 'subtitle', source: 'external', language: 'hin', codec: 'ASS', isHearingImpaired: true }
    ]);
  });
});
