import { describe, expect, it, vi } from 'vitest';
import type { HealthCheck, HealthResult } from './HealthCheck.js';
import { HEALTH_CHECK_TIMEOUT_MS, HealthService } from './healthService.js';

function check(id: string, run: () => Promise<HealthResult>): HealthCheck & { calls: number } {
  const wrapped = { id, label: id.toUpperCase(), calls: 0, run: () => { wrapped.calls++; return run(); } };
  return wrapped;
}

describe('HealthService', () => {
  it('reports every check in order with its state', async () => {
    const service = new HealthService(() => [
      check('a', async () => ({ state: 'ok', message: 'fine' })),
      check('b', async () => ({ state: 'warn', message: 'meh', fix: 'do x' }))
    ], { now: () => new Date('2026-11-10T10:00:00Z') });
    expect(await service.run()).toEqual({
      checkedAt: '2026-11-10T10:00:00.000Z',
      checks: [{ id: 'a', label: 'A', state: 'ok', message: 'fine' }, { id: 'b', label: 'B', state: 'warn', message: 'meh', fix: 'do x' }]
    });
  });

  it('a check that throws is fail with its message', async () => {
    const service = new HealthService(() => [check('boom', async () => { throw new Error('disk on fire'); })]);
    expect((await service.run()).checks[0]).toMatchObject({ state: 'fail', message: 'disk on fire' });
  });

  it('a check that hangs reports warn once the timeout passes, without holding up the others', async () => {
    const service = new HealthService(() => [check('hang', () => new Promise(() => undefined)), check('ok', async () => ({ state: 'ok', message: 'fine' }))], { timeoutMs: 20 });
    const started = Date.now();
    const report = await service.run();
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(report.checks.map((item) => item.state)).toEqual(['warn', 'ok']);
  });

  it('times a hanging check out at 5 s by default', async () => {
    vi.useFakeTimers();
    try {
      const service = new HealthService(() => [check('hang', () => new Promise(() => undefined))]);
      const pending = service.run();
      await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);
      expect(HEALTH_CHECK_TIMEOUT_MS).toBe(5_000);
      expect((await pending).checks[0]).toMatchObject({ state: 'warn', message: 'No answer within 5 s.' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('a second call inside 60 s runs no check; fresh does; after 60 s it runs again', async () => {
    let now = Date.parse('2026-11-10T10:00:00Z');
    const counted = check('a', async () => ({ state: 'ok', message: 'fine' }));
    const service = new HealthService(() => [counted], { now: () => new Date(now) });
    await service.run();
    now += 59_000;
    await service.run();
    expect(counted.calls).toBe(1);
    await service.run(true);
    expect(counted.calls).toBe(2);
    now += 60_000;
    await service.run();
    expect(counted.calls).toBe(3);
  });
});
