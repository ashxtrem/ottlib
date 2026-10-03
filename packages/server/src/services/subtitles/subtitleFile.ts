import { extname } from 'node:path';
import { unzipSync } from 'fflate';
import { subtitleFormats, subtitleLimits } from '../../config/subtitles.js';

export function decodeSubtitle(input: Buffer, filename: string, fallbackFormat: string): { bytes: Buffer; format: string } {
  let data = input; let format = extname(filename).slice(1).toLowerCase();
  if (input[0] === 0x50 && input[1] === 0x4b) {
    let entries = 0; let size = 0;
    const files = unzipSync(input, { filter: file => {
      if (++entries > subtitleLimits.maxArchiveEntries) throw new Error('Subtitle archive has too many files');
      const supported = Boolean(subtitleFormats[extname(file.name).slice(1).toLowerCase()]);
      if (supported) {
        size += file.originalSize;
        if (size > subtitleLimits.maxBytes) throw new Error('Subtitle archive is too large');
      }
      return supported;
    } });
    const subtitles = Object.entries(files);
    if (subtitles.length !== 1) throw new Error('Choose an individual subtitle file instead of a multi-file archive');
    filename = subtitles[0][0]; data = Buffer.from(subtitles[0][1]); format = extname(filename).slice(1).toLowerCase();
  }
  if (!subtitleFormats[format]) format = fallbackFormat;
  if (!subtitleFormats[format]) throw new Error('This subtitle format is unsupported');
  if (!data.length || data.length > subtitleLimits.maxBytes) throw new Error('Subtitle file is empty or too large');
  let text: string;
  if (data[0] === 0xff && data[1] === 0xfe) text = new TextDecoder('utf-16le').decode(data);
  else if (data[0] === 0xfe && data[1] === 0xff) text = new TextDecoder('utf-16be').decode(data);
  else {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); }
    catch { throw new Error('Subtitle encoding is unsupported; choose a UTF-8 subtitle'); }
  }
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (/^\s*(?:<!doctype|<html)/i.test(text) || !(format === 'ass' || format === 'ssa' ? /\[Events\]/i.test(text) && /^Dialogue:/m.test(text) : /\d{1,2}:\d{2}(?::\d{2})?[,.]\d{3}\s*-->/.test(text))) {
    throw new Error('The downloaded file does not contain valid subtitles');
  }
  return { bytes: Buffer.from(text, 'utf8'), format };
}
