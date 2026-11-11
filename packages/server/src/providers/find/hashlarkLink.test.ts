import { describe, expect, it, vi } from 'vitest';
import { HashlarkLink, hashlarkSearchUrl } from './hashlarkLink.js';

describe('hashlarkSearchUrl', () => {
  it('builds the search link from title, year and IMDb id', () => {
    expect(hashlarkSearchUrl({ title: 'The Matrix', year: 1999, imdbId: 'tt0133093' })).toBe('hashlark://search?q=The%20Matrix%201999&cat=movies&imdb=tt0133093');
  });

  it('leaves out the year and the IMDb id when absent', () => {
    expect(hashlarkSearchUrl({ title: 'Heat' })).toBe('hashlark://search?q=Heat&cat=movies');
  });

  it('encodes characters that would split or end the link', () => {
    const url = hashlarkSearchUrl({ title: 'Tom & Jerry: "The Movie" #1 100%', year: 2021 });
    expect(url).toBe('hashlark://search?q=Tom%20%26%20Jerry%3A%20%22The%20Movie%22%20%231%20100%25%202021&cat=movies');
    expect(url.split('?')[1].split('&')).toHaveLength(2);
  });

  it('opens the app without a query when there is no title', () => {
    expect(hashlarkSearchUrl({})).toBe('hashlark://search');
    expect(hashlarkSearchUrl({ year: 1999 })).toBe('hashlark://search');
    expect(hashlarkSearchUrl({ title: '   ' })).toBe('hashlark://search');
  });

  it('caps the title at 200 characters', () => {
    const url = hashlarkSearchUrl({ title: 'a'.repeat(500) });
    expect(url).toBe(`hashlark://search?q=${'a'.repeat(200)}&cat=movies`);
  });
});

describe('HashlarkLink', () => {
  const spawned = () => { const unref = vi.fn(); const spawn = vi.fn(() => ({ unref })); return { spawn, unref }; };

  it('opens the link through rundll32 with no shell, detached and unref-ed', () => {
    const { spawn, unref } = spawned();
    new HashlarkLink(spawn, () => undefined, 'win32').open({ title: 'Tom & Jerry', year: 2021 });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith('rundll32.exe', ['url.dll,FileProtocolHandler', 'hashlark://search?q=Tom%20%26%20Jerry%202021&cat=movies'], { detached: true, stdio: 'ignore', windowsHide: true });
    expect(unref).toHaveBeenCalledTimes(1);
  });

  it('is available when the registry probe succeeds, asking reg.exe for the URL handler', () => {
    const probe = vi.fn();
    expect(new HashlarkLink(spawned().spawn, probe, 'win32').available()).toBe(true);
    expect(probe).toHaveBeenCalledWith('reg.exe', ['query', 'HKCR\\hashlark\\shell\\open\\command', '/ve']);
  });

  it('is not available when the probe fails', () => {
    const probe = () => { throw new Error('exit 1'); };
    expect(new HashlarkLink(spawned().spawn, probe, 'win32').available()).toBe(false);
  });

  it('is not available off Windows, and never runs the probe there', () => {
    const probe = vi.fn();
    expect(new HashlarkLink(spawned().spawn, probe, 'linux').available()).toBe(false);
    expect(probe).not.toHaveBeenCalled();
  });
});
