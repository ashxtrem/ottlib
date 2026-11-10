import type { FastifyInstance } from 'fastify';
import type { HealthService } from '../services/health/healthService.js';

/** `GET /api/health` answers from the 60 s cache; `?fresh=1` runs every check again. */
export function registerHealthRoutes(app: FastifyInstance, health: HealthService): void {
  app.get('/api/health', async (request) => {
    const fresh = (request.query as { fresh?: unknown } | undefined)?.fresh;
    return health.run(fresh === '1' || fresh === 'true');
  });
}
