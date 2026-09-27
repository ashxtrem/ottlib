import type { FastifyInstance } from 'fastify';
import { deviceIdSchema, playbackProgressUpdateSchema } from '@ottlib/shared';
import { MovieRepository } from '../repositories/movieRepository.js';
import { PlaybackProgressService } from '../services/playbackProgressService.js';

function deviceId(headers: Record<string, unknown>): string | undefined { const parsed = deviceIdSchema.safeParse(headers['x-device-id']); return parsed.success ? parsed.data : undefined; }
function limit(value: string | undefined): number { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20; }

export function registerPlaybackProgressRoutes(app: FastifyInstance, movies: MovieRepository, progress: PlaybackProgressService): void {
  app.get('/api/movies/continue-watching', async (request, reply) => {
    const device = deviceId(request.headers); if (!device) return reply.code(400).send({ error: 'X-Device-Id must be a UUID' });
    return movies.listContinueWatching(device, limit((request.query as { limit?: string }).limit));
  });
  app.put('/api/movies/:id/progress', async (request, reply) => {
    const id = Number((request.params as any).id); const device = deviceId(request.headers); if (!device) return reply.code(400).send({ error: 'X-Device-Id must be a UUID' });
    if (!movies.get(id)) return reply.code(404).send({ error: 'Movie not found' });
    return progress.record(id, device, playbackProgressUpdateSchema.parse(request.body));
  });
  app.delete('/api/movies/:id/progress', async (request, reply) => {
    const id = Number((request.params as any).id); const device = deviceId(request.headers); if (!device) return reply.code(400).send({ error: 'X-Device-Id must be a UUID' });
    progress.clear(id, device); return reply.code(204).send();
  });
}
