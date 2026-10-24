import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { deviceIdSchema, profileCreateSchema, profilePatchSchema, profilePinUpdateSchema, profileSelectSchema } from '@ottlib/shared';
import type { LocalResetService } from '../services/localResetService.js';
import type { ProfileService } from '../services/profileService.js';
import type { ProfileSessionService } from '../services/profileSessionService.js';
import { isLoopback } from './loopback.js';
import { profileToken, requireProfile } from './profileContext.js';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const targetId = (request: FastifyRequest) => idParams.parse(request.params).id;

/** Header the reset request must carry. A custom header forces a CORS preflight, which this server never grants. */
export const LOCAL_RESET_HEADER = 'x-ottlib-reset';
/** Headers a reverse proxy or tunnel adds; their presence means the loopback peer may be relaying a remote caller. */
const proxyHeaders = ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-real-ip'] as const;
const loopbackHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;

/**
 * True only for a request typed on the server machine itself: loopback peer, the reset header (so a web page cannot fire
 * it cross-site), no proxy headers, and a loopback Host (so DNS rebinding and local tunnels are refused).
 */
function isLocalResetRequest(request: FastifyRequest): boolean {
  return isLoopback(request.socket.remoteAddress)
    && request.headers[LOCAL_RESET_HEADER] === '1'
    && proxyHeaders.every((name) => request.headers[name] === undefined)
    && loopbackHost.test(request.headers.host ?? '');
}

function deviceId(request: FastifyRequest): string | null {
  const parsed = deviceIdSchema.safeParse(request.headers['x-device-id']);
  return parsed.success ? parsed.data : null;
}

/** Profile API. ProfileErrors thrown by the services are turned into responses by the app's error handler. */
export function registerProfileRoutes(app: FastifyInstance, profiles: ProfileService, sessions: ProfileSessionService, reset: LocalResetService): void {
  app.get('/api/profiles', async () => profiles.list());
  app.post('/api/profiles', async (request, reply) => {
    const actor = requireProfile(request);
    return reply.code(201).send(profiles.create(actor, profileCreateSchema.parse(request.body ?? {})));
  });
  app.post('/api/profiles/:id/select', async (request) => {
    const body = profileSelectSchema.parse(request.body ?? {});
    return sessions.select(targetId(request), body.pin, request.ip, deviceId(request));
  });
  app.post('/api/profiles/deselect', async (request, reply) => {
    const token = profileToken(request);
    if (token) sessions.deselect(token);
    return reply.code(204).send();
  });
  app.get('/api/profiles/me', async (request) => ({ profile: profiles.get(requireProfile(request)) }));
  app.patch('/api/profiles/:id', async (request) => {
    const actor = requireProfile(request);
    return profiles.update(actor, targetId(request), profilePatchSchema.parse(request.body ?? {}));
  });
  app.put('/api/profiles/:id/pin', async (request) => {
    const actor = requireProfile(request);
    return profiles.setPin(actor, targetId(request), profilePinUpdateSchema.parse(request.body ?? {}), request.ip, profileToken(request));
  });
  app.delete('/api/profiles/:id', async (request, reply) => {
    profiles.remove(requireProfile(request), targetId(request));
    return reply.code(204).send();
  });
  // Public in the auth guard so a forgotten access PIN can be cleared — hence only from the server machine itself.
  app.post('/api/profiles/reset-local', async (request, reply) => {
    if (!isLocalResetRequest(request)) return reply.code(403).send({ error: 'PIN reset is only available on the server machine.' });
    return reset.reset();
  });
}
