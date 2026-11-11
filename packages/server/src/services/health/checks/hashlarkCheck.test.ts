import { describe, expect, it } from 'vitest';
import { hashlarkCheck } from './hashlarkCheck.js';

describe('hashlark check', () => {
  it('is ok when the link is registered', async () => {
    expect((await hashlarkCheck(() => true).run()).state).toBe('ok');
  });

  it('warns, with a fix, when it is not', async () => {
    const result = await hashlarkCheck(() => false).run();
    expect(result).toMatchObject({ state: 'warn', message: "Hashlark isn't installed on the server PC." });
    expect(result.fix).toBeTruthy();
  });
});
