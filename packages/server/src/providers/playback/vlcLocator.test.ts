import { describe, expect, it, vi } from 'vitest';
import { VlcLocator, type VlcProbes } from './vlcLocator.js';

function probes(overrides: Partial<VlcProbes>): VlcProbes {
  return { platform: 'linux', env: {}, exists: () => false, lookup: () => null, ...overrides };
}

describe('VlcLocator', () => {
  it('finds VLC under %ProgramFiles% on Windows', () => {
    const locator = new VlcLocator(probes({ platform: 'win32', env: { ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)' }, exists: (path) => path === 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe' }));
    expect(locator.find()).toBe('C:\\Program Files\\VideoLAN\\VLC\\vlc.exe');
  });

  it('falls back to %ProgramFiles(x86)% on Windows', () => {
    const locator = new VlcLocator(probes({ platform: 'win32', env: { ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)' }, exists: (path) => path.startsWith('C:\\Program Files (x86)') }));
    expect(locator.find()).toBe('C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe');
  });

  it('asks `where vlc` on Windows when neither install folder has it', () => {
    const lookup = vi.fn(() => 'D:\\Tools\\vlc.exe');
    expect(new VlcLocator(probes({ platform: 'win32', env: { ProgramFiles: 'C:\\Program Files' }, lookup })).find()).toBe('D:\\Tools\\vlc.exe');
    expect(lookup).toHaveBeenCalledWith('vlc');
  });

  it('finds the app bundle binary on macOS', () => {
    const locator = new VlcLocator(probes({ platform: 'darwin', exists: (path) => path === '/Applications/VLC.app/Contents/MacOS/VLC' }));
    expect(locator.find()).toBe('/Applications/VLC.app/Contents/MacOS/VLC');
  });

  it('uses `which vlc` on Linux', () => {
    expect(new VlcLocator(probes({ platform: 'linux', lookup: (command) => command === 'vlc' ? '/usr/bin/vlc' : null })).find()).toBe('/usr/bin/vlc');
  });

  it('returns null on every platform when VLC is not installed', () => {
    for (const platform of ['win32', 'darwin', 'linux'] as const) expect(new VlcLocator(probes({ platform, env: { ProgramFiles: 'C:\\Program Files' } })).find()).toBeNull();
  });

  it('probes once and caches the result, including null', () => {
    const lookup = vi.fn(() => '/usr/bin/vlc'); const found = new VlcLocator(probes({ lookup }));
    found.find(); found.find(); expect(lookup).toHaveBeenCalledTimes(1);
    const missingLookup = vi.fn(() => null); const missing = new VlcLocator(probes({ lookup: missingLookup }));
    missing.find(); missing.find(); expect(missingLookup).toHaveBeenCalledTimes(1);
  });
});
