import { describe, expect, it } from 'vitest';
import { titleExtrasCheck } from './titleExtras.js';

describe('title extras check', () => {
  it('is ok when nothing is pending', async () => {
    expect(await titleExtrasCheck(() => []).run()).toMatchObject({ state: 'ok', message: 'none pending' });
  });

  it('warns with the number of matched titles without extras', async () => {
    const result = await titleExtrasCheck(() => [1, 2, 3]).run();
    expect(result.state).toBe('warn');
    expect(result.message).toBe('3 matched titles have no extras yet');
  });
});
