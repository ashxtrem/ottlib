import { profilePinSchema } from '@ottlib/shared';
import { ApiError } from '../hooks/apiClient';

export const MAX_PIN_LENGTH = 8;

/** Code the server sends (status 403) for a wrong profile PIN. Not in the shared code list yet. */
export const PROFILE_PIN_INVALID = 'PROFILE_PIN_INVALID';

/** Keeps digits only, at most 8 of them. */
export const sanitizePin = (value: string): string => value.replace(/\D/g, '').slice(0, MAX_PIN_LENGTH);

/** Adds one keypad digit, ignoring presses past the maximum length. */
export const appendPinDigit = (pin: string, digit: string): string => sanitizePin(pin + digit);

export const removeLastPinDigit = (pin: string): string => pin.slice(0, -1);

/** A profile PIN is 4–8 digits. */
export const isCompletePin = (pin: string): boolean => profilePinSchema.safeParse(pin).success;

/** Text shown under a PIN field after a failed select or PIN change. */
export function pinErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === PROFILE_PIN_INVALID || error.status === 401) return 'Wrong PIN. Try again.';
    if (error.status === 429) return error.message || 'Too many wrong PINs. Wait a moment and try again.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}
