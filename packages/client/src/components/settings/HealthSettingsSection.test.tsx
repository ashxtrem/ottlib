import { renderToStaticMarkup } from 'react-dom/server';
import type { HealthReport } from '@ottlib/shared';
import { describe, expect, it, vi } from 'vitest';
import { HealthSectionView } from './HealthSettingsSection';

const report: HealthReport = {
  checkedAt: '2026-11-10T10:00:00Z',
  checks: [
    { id: 'ffmpeg', label: 'ffmpeg', state: 'ok', message: 'ffmpeg 7.1 found' },
    { id: 'disk-space', label: 'Disk space', state: 'warn', message: 'Only 3 GB free on E:', fix: 'Free up space or move the library.' },
    { id: 'database', label: 'Database', state: 'fail', message: 'Integrity check failed', fix: 'Restore a backup.' }
  ]
};
const render = (props: Partial<Parameters<typeof HealthSectionView>[0]>) => renderToStaticMarkup(<HealthSectionView report={report} checking={false} onCheckAgain={vi.fn()} {...props} />);

describe('HealthSectionView', () => {
  it('shows each check with its state, message and fix', () => {
    const markup = render({});
    for (const text of ['ffmpeg 7.1 found', 'Warning', 'Problem', 'OK', 'Only 3 GB free on E:', 'Free up space or move the library.', 'Integrity check failed', 'Restore a backup.']) expect(markup).toContain(text);
    expect(markup.match(/Fix: /g)).toHaveLength(2);
  });

  it('offers Check again, disabled while checking', () => {
    expect(render({})).toContain('Check again');
    expect(render({ checking: true })).toMatch(/<button[^>]*disabled=""[^>]*>Checking…/);
  });

  it('shows a loading line and a fetch error before any report', () => {
    expect(render({ report: undefined })).toContain('Checking the server');
    const markup = render({ report: undefined, error: 'Network down' });
    expect(markup).toContain('Network down');
    expect(markup).not.toContain('Checking the server');
  });
});
