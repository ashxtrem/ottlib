import { describe, expect, it } from 'vitest';
import { ApiError } from '../hooks/apiClient';
import { appendPinDigit, isCompletePin, pinErrorMessage, removeLastPinDigit, sanitizePin } from './pinInput';

describe('PIN input helpers', () => {
  it('keeps digits only, at most 8', () => {
    expect(sanitizePin('12a3 4-56789')).toBe('12345678');
  });

  it('appends keypad digits up to the maximum and removes the last one', () => {
    expect(appendPinDigit('123', '4')).toBe('1234');
    expect(appendPinDigit('12345678', '9')).toBe('12345678');
    expect(removeLastPinDigit('123')).toBe('12');
    expect(removeLastPinDigit('')).toBe('');
  });

  it('accepts 4 to 8 digits', () => {
    expect(isCompletePin('123')).toBe(false);
    expect(isCompletePin('1234')).toBe(true);
    expect(isCompletePin('12345678')).toBe(true);
    expect(isCompletePin('123456789')).toBe(false);
  });

  it('turns wrong-PIN and throttle replies into messages', () => {
    expect(pinErrorMessage(new ApiError('Wrong PIN.', 403, 'PROFILE_PIN_INVALID'))).toBe('Wrong PIN. Try again.');
    expect(pinErrorMessage(new ApiError('Too many wrong PINs. Try again in 30 seconds.', 429))).toBe('Too many wrong PINs. Try again in 30 seconds.');
    expect(pinErrorMessage(new ApiError('Only the owner profile can do that.', 403))).toBe('Only the owner profile can do that.');
  });
});
