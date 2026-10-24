import type { FastifyInstance } from 'fastify';
import { hideImportSchema, hideRequestSchema } from '@ottlib/shared';
import type { HideService } from '../services/hideService.js';
import { requireProfile } from './profileContext.js';

/** Hidden titles of the current profile. Every call answers with the profile's keys, newest first. */
export function registerHideRoutes(app: FastifyInstance, hides: HideService): void {
  app.get('/api/hides', async (request) => ({ keys: hides.list(requireProfile(request)) }));
  app.post('/api/hides', async (request) => {
    const profileId = requireProfile(request);
    return { keys: hides.add(profileId, hideRequestSchema.parse(request.body ?? {}).key) };
  });
  app.delete('/api/hides', async (request) => {
    const profileId = requireProfile(request);
    return { keys: hides.remove(profileId, hideRequestSchema.parse(request.body ?? {}).key) };
  });
  app.post('/api/hides/import', async (request) => {
    const profileId = requireProfile(request);
    return { keys: hides.import(profileId, hideImportSchema.parse(request.body ?? {}).keys) };
  });
}
