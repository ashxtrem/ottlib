import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { autoSkipDefaultsSchema, autoSkipOverrideRequestSchema, creditsMarkRequestSchema } from '@ottlib/shared';
import { CreditsMovieNotFoundError, type CreditsEditService } from '../services/credits/creditsEditService.js';
import { viewerOf } from './viewer.js';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

/** The credits mark (shared) and the current profile's auto-skip override and defaults. */
export function registerCreditsRoutes(app: FastifyInstance, credits: CreditsEditService): void {
  app.put('/api/movies/:id/credits', async (request, reply) => {
    viewerOf(request); // The mark is shared by every profile, but setting one still needs a profile session.
    const { id } = paramsSchema.parse(request.params);
    const { startMs } = creditsMarkRequestSchema.parse(request.body ?? {});
    try { return { credits: credits.setMark(id, startMs) }; } catch (error) { return notFound(reply, error); }
  });
  app.put('/api/movies/:id/auto-skip', async (request, reply) => {
    const { profileId } = viewerOf(request);
    const { id } = paramsSchema.parse(request.params);
    const { enabled } = autoSkipOverrideRequestSchema.parse(request.body ?? {});
    try { return { autoSkipCredits: credits.setOverride(profileId, id, enabled) }; } catch (error) { return notFound(reply, error); }
  });
  app.get('/api/profiles/current/auto-skip', async (request) => credits.defaults(viewerOf(request).profileId));
  app.put('/api/profiles/current/auto-skip', async (request) => {
    const { profileId } = viewerOf(request);
    return credits.setDefaults(profileId, autoSkipDefaultsSchema.parse(request.body ?? {}));
  });
}

function notFound(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof CreditsMovieNotFoundError) return reply.code(404).send({ error: error.message });
  throw error;
}
