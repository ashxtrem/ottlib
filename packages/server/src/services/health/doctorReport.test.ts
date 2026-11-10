import { describe, expect, it } from 'vitest';
import { doctorReport } from './doctorReport.js';

describe('doctorReport', () => {
  it('prints one line per check with its fix, and exits 1 on a fail', () => {
    const { lines, exitCode } = doctorReport({ checkedAt: 'now', checks: [
      { id: 'a', label: 'Disk space', state: 'ok', message: '9 GB free.' },
      { id: 'b', label: 'Library folders', state: 'fail', message: 'Cannot read D:\\Movies.', fix: 'Reconnect it.' }
    ] });
    expect(lines).toEqual(['OK   Disk space: 9 GB free.', 'FAIL Library folders: Cannot read D:\\Movies.', '     Fix: Reconnect it.']);
    expect(exitCode).toBe(1);
  });

  it('exits 0 with only ok and warn', () => {
    expect(doctorReport({ checkedAt: 'now', checks: [{ id: 'a', label: 'A', state: 'warn', message: 'meh' }] }).exitCode).toBe(0);
  });
});
