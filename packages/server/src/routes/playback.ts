import type { FastifyInstance } from 'fastify';
import { PlaybackService } from '../services/playbackService.js';

function isLoopback(address: string | undefined): boolean { return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'; }

export function registerPlaybackRoutes(app: FastifyInstance, playback: PlaybackService): void {
  app.post('/api/movies/:id/play-local', async (request, reply) => {
    if (!isLoopback(request.socket.remoteAddress)) return reply.code(403).send({ error: 'Local playback is only available from localhost' });
    try { await playback.playLocal(Number((request.params as any).id)); return reply.code(204).send(); } catch (error) { return reply.code(404).send({ error: error instanceof Error ? error.message : 'Movie file is unavailable' }); }
  });
  app.post('/api/movies/:id/reveal', async (request, reply) => {
    if (!isLoopback(request.socket.remoteAddress)) return reply.code(403).send({ error: 'Folder reveal is only available from localhost' });
    try { await playback.reveal(Number((request.params as any).id)); return reply.code(204).send(); } catch (error) { return reply.code(404).send({ error: error instanceof Error ? error.message : 'Movie file is unavailable' }); }
  });
}
