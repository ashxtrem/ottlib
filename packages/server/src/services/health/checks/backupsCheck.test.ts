import { describe, expect, it } from 'vitest';
import type { Backup } from '@ottlib/shared';
import type { DailyResult } from '../../backupService.js';
import { backupsCheck } from './backupsCheck.js';

const now = () => new Date('2026-11-10T12:00:00Z');
const backup = (createdAt: string): Backup => ({ name: 'daily-x.sqlite', kind: 'daily', sizeBytes: 1, createdAt });
const source = (list: Backup[], daily: DailyResult | null = null) => ({ list: () => list, lastDailyResult: () => daily });

describe('backups check', () => {
  it('is ok with a backup in the last 8 days', async () => {
    expect((await backupsCheck(source([backup('2026-11-01T00:00:00Z'), backup('2026-11-09T04:00:00Z')]), now).run()).state).toBe('ok');
  });

  it('warns with no backup yet, or only older ones', async () => {
    expect((await backupsCheck(source([]), now).run())).toMatchObject({ state: 'warn', message: 'No backup yet.' });
    expect((await backupsCheck(source([backup('2026-11-01T00:00:00Z')]), now).run()).state).toBe('warn');
  });

  it('fails when the last daily backup failed', async () => {
    const result = await backupsCheck(source([backup('2026-11-09T04:00:00Z')], { ok: false, at: '2026-11-10T04:00:00Z', error: 'disk full' }), now).run();
    expect(result.state).toBe('fail');
    expect(result.message).toContain('disk full');
  });
});
