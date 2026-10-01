import { z } from 'zod';

/** An access PIN is 4–8 digits, so it can be typed with a TV remote's number pad. */
export const accessPinSchema = z.string().regex(/^\d{4,8}$/, 'PIN must be 4 to 8 digits.');

export const authStatusSchema = z.object({
  pinEnabled: z.boolean(),
  authenticated: z.boolean()
});

export const pinLoginSchema = z.object({ pin: z.string().min(1).max(32) });
export const pinLoginResultSchema = z.object({ token: z.string() });
export const setAccessPinSchema = z.object({ currentPin: z.string().max(32).optional(), newPin: accessPinSchema });
export const removeAccessPinSchema = z.object({ currentPin: z.string().min(1).max(32) });

export type AuthStatus = z.infer<typeof authStatusSchema>;
export type PinLoginResult = z.infer<typeof pinLoginResultSchema>;
export type SetAccessPin = z.infer<typeof setAccessPinSchema>;
