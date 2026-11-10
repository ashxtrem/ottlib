import { renderToStaticMarkup } from 'react-dom/server';
import type { Backup } from '@ottlib/shared';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../hooks/apiClient';
import { formatBackupSize, restoreErrorMessage } from '../../utils/backupLabels';
import { BackupSectionView } from './BackupSettingsSection';

const backups: Backup[] = [
  { name: 'manual-20261110-040000.sqlite', kind: 'manual', sizeBytes: 5_242_880, createdAt: '2026-11-10T04:00:00Z' },
  { name: 'daily-20261109-040000.sqlite', kind: 'daily', sizeBytes: 900, createdAt: '2026-11-09T04:00:00Z' }
];
const render = (props: Partial<Parameters<typeof BackupSectionView>[0]>) => renderToStaticMarkup(<BackupSectionView
  enabled savingEnabled={false} onEnabledChange={vi.fn()} backups={backups} creating={false} onCreate={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} isLocalClient restartPending={false} {...props} />);

describe('BackupSectionView', () => {
  it('lists each backup with kind, date and size', () => {
    const markup = render({});
    expect(markup).toContain('Manual');
    expect(markup).toContain('Daily');
    expect(markup).toContain('5.0 MB');
    expect(markup).toContain('900 B');
    expect(markup.match(/>Delete</g)).toHaveLength(2);
  });

  it('enables Restore on the server PC', () => {
    const markup = render({ isLocalClient: true });
    expect(markup.match(/<button[^>]*>Restore</g)?.every((button) => !button.includes('disabled=""'))).toBe(true);
    expect(markup).not.toContain('only available when you open OttLib on the server PC');
  });

  it('disables Restore elsewhere and says why', () => {
    const markup = render({ isLocalClient: false });
    expect(markup.match(/<button[^>]*>Restore</g)).toHaveLength(2);
    expect(markup.match(/<button[^>]*>Restore</g)?.every((button) => button.includes('disabled=""'))).toBe(true);
    expect(markup).toContain('only available when you open OttLib on the server PC');
  });

  it('reflects the daily toggle and shows the restart line after a restore', () => {
    expect(render({ enabled: true })).toMatch(/<input[^>]*checked=""/);
    expect(render({ enabled: false })).not.toMatch(/<input[^>]*checked=""/);
    expect(render({})).not.toContain('Restart OttLib');
    expect(render({ restartPending: true })).toContain('Restart OttLib');
  });

  it('shows empty, loading and error states', () => {
    expect(render({ backups: [] })).toContain('No backups yet');
    expect(render({ backups: undefined })).toContain('Loading backups');
    expect(render({ backups: undefined, listError: 'Boom' })).toContain('Boom');
    expect(render({ actionError: 'Restore only works on the server PC' })).toContain('Restore only works on the server PC');
  });
});

describe('restoreErrorMessage', () => {
  it('maps a 403 to the server-PC reason', () => {
    expect(restoreErrorMessage(new ApiError('Restoring a backup is only allowed from the server machine', 403))).toBe('Restore only works on the server PC');
  });

  it('keeps other messages', () => {
    expect(restoreErrorMessage(new ApiError('Backup not found', 404))).toBe('Backup not found');
    expect(restoreErrorMessage(new Error('Network down'))).toBe('Network down');
  });
});

describe('formatBackupSize', () => {
  it('scales to a readable unit', () => {
    expect(formatBackupSize(0)).toBe('0 B');
    expect(formatBackupSize(1536)).toBe('1.5 KB');
    expect(formatBackupSize(25 * 1024 * 1024)).toBe('25 MB');
  });
});
