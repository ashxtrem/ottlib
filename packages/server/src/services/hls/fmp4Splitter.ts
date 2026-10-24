/**
 * Splits ffmpeg's fragmented-MP4 stdout into the init segment (ftyp + moov) and one piece per fragment (moof + mdat), and
 * reads when each fragment starts (presentation time of its first video sample) so it can be matched to the segment plan.
 */
export type Fmp4Piece =
  | { kind: 'init'; bytes: Buffer }
  | { kind: 'fragment'; bytes: Buffer; startMs: number | null };

interface Box { type: string; start: number; end: number; bodyStart: number }

function boxesIn(data: Buffer, from: number, to: number): Box[] {
  const boxes: Box[] = [];
  let offset = from;
  while (offset + 8 <= to) {
    let size = data.readUInt32BE(offset); let header = 8;
    if (size === 1 && offset + 16 <= to) { size = Number(data.readBigUInt64BE(offset + 8)); header = 16; }
    if (size < header || offset + size > to) break;
    boxes.push({ type: data.toString('latin1', offset + 4, offset + 8), start: offset, end: offset + size, bodyStart: offset + header });
    offset += size;
  }
  return boxes;
}

const child = (data: Buffer, box: Box, type: string) => boxesIn(data, box.bodyStart, box.end).find((item) => item.type === type);
const children = (data: Buffer, box: Box, type: string) => boxesIn(data, box.bodyStart, box.end).filter((item) => item.type === type);

/** Field after a full-box header (version + flags): 32-bit when version 0, 64-bit when 1. */
function versioned(data: Buffer, box: Box, offsetV0: number, offsetV1: number): number {
  const version = data[box.bodyStart];
  return version === 1 ? Number(data.readBigUInt64BE(box.bodyStart + offsetV1)) : data.readUInt32BE(box.bodyStart + offsetV0);
}

export interface VideoTrack { trackId: number; timescale: number }

/** The video track's id and timescale from a moov box. */
export function videoTrackOf(data: Buffer, moov: Box): VideoTrack | null {
  for (const trak of children(data, moov, 'trak')) {
    const tkhd = child(data, trak, 'tkhd'); const mdia = child(data, trak, 'mdia');
    const mdhd = mdia && child(data, mdia, 'mdhd'); const hdlr = mdia && child(data, mdia, 'hdlr');
    if (!tkhd || !mdhd || !hdlr || data.toString('latin1', hdlr.bodyStart + 8, hdlr.bodyStart + 12) !== 'vide') continue;
    const trackId = data.readUInt32BE(tkhd.bodyStart + (data[tkhd.bodyStart] === 1 ? 20 : 12));
    const timescale = data.readUInt32BE(mdhd.bodyStart + (data[mdhd.bodyStart] === 1 ? 20 : 12));
    return { trackId, timescale };
  }
  return null;
}

/** Decode time + composition offset of the first video sample of a moof, in the track's timescale. */
export function fragmentStart(data: Buffer, moof: Box, track: VideoTrack): number | null {
  for (const traf of children(data, moof, 'traf')) {
    const tfhd = child(data, traf, 'tfhd'); const tfdt = child(data, traf, 'tfdt');
    if (!tfhd || !tfdt || data.readUInt32BE(tfhd.bodyStart + 4) !== track.trackId) continue;
    let start = versioned(data, tfdt, 4, 4);
    const trun = child(data, traf, 'trun');
    if (trun) {
      const version = data[trun.bodyStart]; const flags = data.readUIntBE(trun.bodyStart + 1, 3);
      let at = trun.bodyStart + 8;
      for (const flag of [0x1, 0x4, 0x100, 0x200, 0x400]) if (flags & flag) at += 4;
      if (flags & 0x800) start += version === 1 ? data.readInt32BE(at) : data.readUInt32BE(at);
    }
    return start;
  }
  return null;
}

export class Fmp4Splitter {
  /** Unparsed stdout, kept as chunks so a large mdat is joined once, when it is complete. */
  private chunks: Buffer[] = [];
  private length = 0;
  private ftyp: Buffer | null = null;
  private video: VideoTrack | null = null;
  private moof: { bytes: Buffer; startMs: number | null } | null = null;

  /** `offsetMs` is subtracted from fragment times (the session's `timelineOffsetSeconds`). */
  public constructor(private readonly offsetMs: number) {}

  public push(chunk: Buffer): Fmp4Piece[] {
    this.chunks.push(chunk); this.length += chunk.length;
    const pieces: Fmp4Piece[] = [];
    for (;;) {
      const size = this.nextBoxSize();
      if (size === null || this.length < size) break;
      const box = this.take(size);
      const piece = this.handle(box.toString('latin1', 4, 8), box);
      if (piece) pieces.push(piece);
    }
    return pieces;
  }

  private nextBoxSize(): number | null {
    if (this.length < 8) return null;
    const head = this.peek(Math.min(16, this.length));
    const size = head.readUInt32BE(0);
    if (size === 1) return head.length < 16 ? null : Number(head.readBigUInt64BE(8));
    if (size < 8) throw new Error('Malformed MP4 box from ffmpeg');
    return size;
  }

  private peek(bytes: number): Buffer {
    if (this.chunks[0].length >= bytes) return this.chunks[0];
    return Buffer.concat(this.chunks).subarray(0, bytes);
  }

  private take(bytes: number): Buffer {
    const all = this.chunks.length === 1 ? this.chunks[0] : Buffer.concat(this.chunks, this.length);
    const box = Buffer.from(all.subarray(0, bytes));
    const rest = all.subarray(bytes);
    this.chunks = rest.length ? [rest] : []; this.length = rest.length;
    return box;
  }

  private handle(type: string, bytes: Buffer): Fmp4Piece | null {
    const whole = { type, start: 0, end: bytes.length, bodyStart: 8 };
    if (type === 'ftyp') { this.ftyp = bytes; return null; }
    if (type === 'moov') {
      this.video = videoTrackOf(bytes, whole);
      return { kind: 'init', bytes: this.ftyp ? Buffer.concat([this.ftyp, bytes]) : bytes };
    }
    if (type === 'moof') {
      const start = this.video ? fragmentStart(bytes, whole, this.video) : null;
      this.moof = { bytes, startMs: start === null || !this.video ? null : (start / this.video.timescale) * 1000 - this.offsetMs };
      return null;
    }
    if (type === 'mdat' && this.moof) {
      const piece: Fmp4Piece = { kind: 'fragment', bytes: Buffer.concat([this.moof.bytes, bytes]), startMs: this.moof.startMs };
      this.moof = null;
      return piece;
    }
    return null;
  }
}
