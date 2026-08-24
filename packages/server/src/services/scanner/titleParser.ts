import { basename, dirname, extname } from 'node:path';
import { episodeTags, releaseTags, releaseYearUpperBoundOffset } from '../../config/defaults.js';
const genreTags = /\b(?:comedy|drama|action|horror|thriller|sci-?fi|documentary|crime|romance|mystery|fantasy|animation|adventure|family|musical|western|biography)\b/gi;
const emptyBrackets = /[[({]\s*[)\]}]/g;
const leadingTrackNumber = /^0\d{1,2}[\s._-]+(?=\S)/;
const genericTitles = new Set(['movie', 'video', 'sample', 'untitled']);

export interface ParsedTitle { title: string; year: number | null }

export function parseTitle(filePath: string): ParsedTitle {
  const fileName = basename(filePath, extname(filePath));
  const parsed = parseReleaseName(fileName);
  if (parsed.title && !genericTitles.has(parsed.title.toLowerCase())) return parsed;
  const fallback = basename(dirname(filePath)).replace(/[._-]+/g, ' ').trim();
  return { ...parsed, title: fallback || parsed.title || 'Untitled' };
}

export function parseReleaseName(name: string): ParsedTitle {
  const normalized = name.replace(leadingTrackNumber, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const raw = normalized || name.trim();
  const currentYear = new Date().getFullYear() + releaseYearUpperBoundOffset;
  const yearMatch = raw.match(/\b(18[89]\d|19\d{2}|20\d{2})\b/);
  const year = yearMatch && Number(yearMatch[0]) <= currentYear ? Number(yearMatch[0]) : null;
  const beforeYear = (yearMatch ? raw.slice(0, yearMatch.index) : raw).replace(/[\s([{_-]+$/, '').trim();
  const stripped = beforeYear.replace(releaseTags, '').replace(episodeTags, '').replace(genreTags, '').replace(emptyBrackets, '').replace(/\s+/g, ' ').trim();
  return { title: stripped || raw || 'Untitled', year };
}
