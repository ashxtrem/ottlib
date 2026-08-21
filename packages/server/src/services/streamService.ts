import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { mimeTypes } from '../config/defaults.js';
import { PlaybackService } from './playbackService.js';

export interface StreamResponse { statusCode: 200 | 206; headers: Record<string, string>; stream?: ReturnType<typeof createReadStream> }
export class RangeError extends Error { public constructor(public readonly size: number) { super('Requested range is not satisfiable'); } }

export class StreamService {
  public constructor(private readonly playback: PlaybackService) {}
  public async open(id: number, range: string | undefined, includeBody: boolean): Promise<StreamResponse> {
    const movie = await this.playback.movieFile(id); const details = await stat(movie.path); const size = details.size;
    const extension = extname(movie.filename).slice(1).toLowerCase(); const headers: Record<string, string> = {
      'accept-ranges': 'bytes', 'content-type': mimeTypes[extension] ?? 'application/octet-stream',
      'content-disposition': `inline; filename="${basename(movie.filename).replace(/["\\]/g, '_')}"`,
      'last-modified': details.mtime.toUTCString(), etag: `W/"${size}-${Math.floor(details.mtimeMs)}"`
    };
    if (!range) return { statusCode: 200, headers: { ...headers, 'content-length': String(size) }, stream: includeBody ? createReadStream(movie.path) : undefined };
    const parsed = parseRange(range, size); headers['content-range'] = `bytes ${parsed.start}-${parsed.end}/${size}`; headers['content-length'] = String(parsed.end - parsed.start + 1);
    return { statusCode: 206, headers, stream: includeBody ? createReadStream(movie.path, parsed) : undefined };
  }
}

function parseRange(header: string, size: number): { start: number; end: number } {
  if (!header.startsWith('bytes=') || header.includes(',')) throw new RangeError(size);
  const [startPart, endPart] = header.slice(6).split('-'); if (startPart === undefined || endPart === undefined) throw new RangeError(size);
  if (!startPart) { const suffix = Number(endPart); if (!Number.isInteger(suffix) || suffix <= 0) throw new RangeError(size); return { start: Math.max(0, size - suffix), end: size - 1 }; }
  const start = Number(startPart); const end = endPart ? Number(endPart) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) throw new RangeError(size);
  return { start, end: Math.min(end, size - 1) };
}
