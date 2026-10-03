import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { decodeSubtitle } from './subtitleFile.js';
import { subtitleLimits } from '../../config/subtitles.js';

const subtitle = Buffer.from('1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n');
describe('downloaded subtitle validation', () => {
  it('normalizes text and safely extracts a single subtitle', () => {
    const decoded = decodeSubtitle(Buffer.from(zipSync({ '../movie.srt': subtitle, 'readme.txt': Buffer.from('ignore') })), 'download.zip', 'srt');
    expect(decoded).toEqual({ bytes: Buffer.from(subtitle.toString().replaceAll('\r', '')), format: 'srt' });
  });
  it('rejects ambiguous episode archives, oversized extraction, and error pages', () => {
    expect(() => decodeSubtitle(Buffer.from(zipSync({ 'one.srt': subtitle, 'two.srt': subtitle })), 'pack.zip', 'srt')).toThrow('individual');
    expect(() => decodeSubtitle(Buffer.from(zipSync({ 'huge.srt': Buffer.alloc(subtitleLimits.maxBytes + 1) })), 'pack.zip', 'srt')).toThrow('too large');
    expect(() => decodeSubtitle(Buffer.from('<html>Sign in</html>'), 'error.srt', 'srt')).toThrow('valid subtitles');
    expect(() => decodeSubtitle(Buffer.from('advertisement'), 'movie.srt', 'srt')).toThrow('valid subtitles');
  });
  it('supports UTF-16 and refuses to corrupt other encodings', () => {
    expect(decodeSubtitle(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(subtitle.toString(), 'utf16le')]), 'movie.srt', 'srt').bytes.toString()).toContain('Hello');
    expect(() => decodeSubtitle(Buffer.from([0xff, 0xfd, 0x30]), 'movie.srt', 'srt')).toThrow('encoding');
  });
});
