import { basename, dirname, extname } from 'node:path';

const releaseTags = /\b(?:2160p|1080p|720p|480p|x264|x265|hevc|h\.?(?:264|265)|bluray|brrip|webrip|web[- ]?dl|dvdrip|remux|hdrip|aac|dts|atmos|truehd|dual[ .-]?audio|multi|proper|repack|extended|unrated|limited)\b/gi;
const episodeTags = /\b(?:s\d{1,2}\s?e\d{1,3}|\d{1,2}x\d{2,3}|season\s?\d{1,2}(?:\s?episode\s?\d{1,3})?|episode\s?\d{1,3})\b/gi;
const genreTags = /\b(?:comedy|drama|action|horror|thriller|sci-?fi|documentary|crime|romance|mystery|fantasy|animation|adventure|family|musical|western|biography)\b/gi;
const emptyBrackets = /[[({]\s*[)\]}]/g;
const leadingTrackNumber = /^0\d{1,2}[\s._-]+(?=\S)/;
const genericTitles = new Set(['movie', 'video', 'sample', 'untitled']);

export interface ParsedTitle { title: string; year: number | null }

export function parseTitle(filePath: string): ParsedTitle {
  const normalized = basename(filePath, extname(filePath)).replace(leadingTrackNumber, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const raw = normalized || basename(filePath, extname(filePath));
  const currentYear = new Date().getFullYear() + 1;
  const yearMatch = raw.match(new RegExp(`\\b(18[89]\d|19\\d{2}|20\\d{2})\\b`));
  const year = yearMatch && Number(yearMatch[0]) <= currentYear ? Number(yearMatch[0]) : null;
  const beforeYear = (yearMatch ? raw.slice(0, yearMatch.index) : raw).replace(/[\s([{_-]+$/, '').trim();
  const stripped = beforeYear.replace(releaseTags, '').replace(episodeTags, '').replace(genreTags, '').replace(emptyBrackets, '').replace(/\s+/g, ' ').trim();
  const fallback = basename(dirname(filePath)).replace(/[._-]+/g, ' ').trim();
  const title = !stripped || genericTitles.has(stripped.toLowerCase()) ? fallback : stripped;
  return { title: title || raw || 'Untitled', year };
}
