import type { FastifyInstance } from 'fastify';
import { findHandoffRequestSchema } from '@ottlib/shared';
import { FindError, FindHandoffService } from '../services/findHandoffService.js';

/** `GET /api/find/status` is always on; `POST /api/find/handoff` answers only while Find is set to Hashlark (404 otherwise). */
export function registerFindRoutes(app: FastifyInstance, find: FindHandoffService): void {
  app.get('/api/find/status', async () => find.status());
  void app.register(async (scope) => {
    scope.addHook('onRequest', async (_request, reply) => { if (find.mode() !== 'hashlark') return reply.code(404).send({ error: 'Find is not set to Hashlark. Choose it in Settings.' }); });
    scope.post('/api/find/handoff', async (request, reply) => {
      const body = findHandoffRequestSchema.safeParse(request.body ?? {});
      if (!body.success) return reply.code(400).send({ error: 'Invalid find request' });
      try { return find.send(body.data); } catch (error) {
        if (error instanceof FindError) return reply.code(409).send({ error: error.code, message: error.message });
        throw error;
      }
    });
  });
}
