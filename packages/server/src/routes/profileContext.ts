import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PROFILE_SESSION_HEADER } from '@ottlib/shared';
import { ProfileError } from '../services/profileError.js';
import type { ProfileSessionService } from '../services/profileSessionService.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** The profile signed in with `x-profile-session`, if any. Profile-scoped routes call `requireProfile` instead. */
    profileId: number | undefined;
    /** The session service, reachable from `requireProfile` without passing it into every route file. */
    readonly profileSessions: ProfileSessionService;
  }
}

/** The raw profile session token a request carries, if any. */
export function profileToken(request: FastifyRequest): string | undefined {
  const value = request.headers[PROFILE_SESSION_HEADER];
  return typeof value === 'string' && value ? value : undefined;
}

/** Resolves `x-profile-session` on every request into `request.profileId`. */
export function registerProfileContext(app: FastifyInstance, sessions: ProfileSessionService): void {
  app.decorateRequest('profileId', undefined);
  app.decorateRequest('profileSessions', { getter: () => sessions });
  app.addHook('onRequest', async (request) => {
    const token = profileToken(request);
    request.profileId = token ? sessions.sessionProfile(token) : undefined;
  });
}

/** The profile this request acts as; throws (→ 409 PROFILE_REQUIRED) when the client has to pick one first. */
export function requireProfile(request: FastifyRequest): number {
  return request.profileSessions.requireProfile(request.profileId);
}

/** Sends a ProfileError: 409s carry their code as `error` (with a readable `message`), the rest a readable `error`. */
export function sendProfileError(reply: FastifyReply, error: ProfileError): FastifyReply {
  return reply.code(error.statusCode).send(error.code ? { error: error.code, message: error.message } : { error: error.message });
}
