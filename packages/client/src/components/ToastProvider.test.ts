import { describe, expect, it } from 'vitest';
import { toastTimeoutByTone } from './ToastProvider';

describe('toast timeout policy', () => {
  it('keeps errors visible until dismissed and gives informational feedback more time', () => {
    expect(toastTimeoutByTone.error).toBeUndefined();
    expect(toastTimeoutByTone.success).toBe(4_000);
    expect(toastTimeoutByTone.info).toBeGreaterThan(toastTimeoutByTone.success!);
  });
});
