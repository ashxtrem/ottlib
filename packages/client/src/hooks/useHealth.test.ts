import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.fn();
vi.mock('./apiClient', () => ({ api: (...args: unknown[]) => api(...args) }));

import { fetchHealth } from './useHealth';
import { healthPath } from '../utils/healthChecks';

describe('health fetching', () => {
  beforeEach(() => { api.mockReset(); api.mockResolvedValue({ checkedAt: 'now', checks: [] }); });

  it('asks for the cached report normally and for ?fresh=1 on Check again', async () => {
    await fetchHealth(false);
    await fetchHealth(true);
    expect(api.mock.calls.map((call) => call[0])).toEqual(['/api/health', '/api/health?fresh=1']);
  });

  it('builds the path', () => {
    expect(healthPath(false)).toBe('/api/health');
    expect(healthPath(true)).toBe('/api/health?fresh=1');
  });
});
