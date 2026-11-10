import { describe, expect, it } from 'vitest';
import { loadStageForElapsed } from './useLoadStage';

describe('loadStageForElapsed', () => {
  it.each([
    [0, 'quiet'],
    [149, 'quiet'],
    [150, 'skeleton'],
    [9999, 'skeleton'],
    [10000, 'reassure'],
  ])('%i ms is %s', (elapsed, stage) => {
    expect(loadStageForElapsed(elapsed)).toBe(stage);
  });
});
