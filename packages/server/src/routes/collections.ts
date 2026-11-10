import type { FastifyInstance } from 'fastify';
import type { CollectionService } from '../services/collectionService.js';
import { requireProfile } from './profileContext.js';

export function registerCollectionRoutes(app: FastifyInstance, collections: CollectionService): void {
  app.get('/api/movies/:id/collection', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const collection = Number.isInteger(id) ? await collections.forMovie(id, requireProfile(request)) : null;
    return collection ?? reply.code(404).send({ error: 'No collection' });
  });
}
