import { describe, expect, it, vi } from 'vitest';
import type { FindProvider } from '@ottlib/shared';
import type { FindHandoff } from '../providers/find/FindHandoff.js';
import { FindError, FindHandoffService } from './findHandoffService.js';

function service(available: boolean, settings: { torrentSearchEnabled: boolean; findProvider: FindProvider } = { torrentSearchEnabled: true, findProvider: 'hashlark' }) {
  const open = vi.fn();
  const handoff: FindHandoff = { name: 'hashlark', available: () => available, open };
  return { open, find: new FindHandoffService(handoff, () => settings) };
}

describe('FindHandoffService', () => {
  it('reports the mode and whether Hashlark is registered', () => {
    expect(service(true).find.status()).toEqual({ mode: 'hashlark', hashlarkAvailable: true });
    expect(service(false, { torrentSearchEnabled: true, findProvider: 'qbittorrent' }).find.status()).toEqual({ mode: 'qbittorrent', hashlarkAvailable: false });
    expect(service(true, { torrentSearchEnabled: false, findProvider: 'hashlark' }).find.status().mode).toBe('off');
  });

  it('opens the app on the query and answers with the app name', () => {
    const { open, find } = service(true);
    expect(find.send({ title: 'Heat', year: 1995 })).toEqual({ app: 'hashlark' });
    expect(open).toHaveBeenCalledExactlyOnceWith({ title: 'Heat', year: 1995 });
  });

  it('throws HASHLARK_NOT_FOUND, without opening anything, when it is not installed', () => {
    const { open, find } = service(false);
    expect(() => find.send({ title: 'Heat' })).toThrow(FindError);
    try { find.send({}); } catch (error) { expect(error).toMatchObject({ code: 'HASHLARK_NOT_FOUND', message: "Hashlark isn't installed on the server PC." }); }
    expect(open).not.toHaveBeenCalled();
  });
});
