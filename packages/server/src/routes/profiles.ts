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
    return profiles.setPin(actor, targetId(request), profilePinUpdateSchema.parse(request.body ?? {}), request.ip);
  });
  app.delete('/api/profiles/:id', async (request, reply) => {
    profiles.remove(requireProfile(request), targetId(request));
    return reply.code(204).send();
  });
  // Public in the auth guard so a forgotten access PIN can be cleared — hence loopback only.
  app.post('/api/profiles/reset-local', async (request, reply) => {
    if (!isLoopback(request.socket.remoteAddress)) return reply.code(403).send({ error: 'PIN reset is only available on the server machine.' });
    return reset.reset();
  });
}
