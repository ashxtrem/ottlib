import type { FastifyInstance } from 'fastify';
import { playLocalRequestSchema } from '@ottlib/shared';
import { PlaybackService } from '../services/playbackService.js';
import { isLoopback } from './loopback.js';
import { requireProfile } from './profileContext.js';

export function registerPlaybackRoutes(app: FastifyInstance, playback: PlaybackService): void {
  app.post('/api/movies/:id/play-local', async (request, reply) => {
    if (!isLoopback(request.socket.remoteAddress)) return reply.code(403).send({ error: 'Local playback is only available from localhost' });
    const body = playLocalRequestSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Invalid play-local request' });
    if (body.data.requireVlc && !playback.hasVlc()) return reply.code(409).send({ error: 'VLC_NOT_FOUND', message: 'VLC is not installed on the server machine' });
    try { await playback.playLocal(Number((request.params as any).id), body.data.startSec); return reply.code(204).send(); } catch (error) { return reply.code(404).send({ error: error instanceof Error ? error.message : 'Movie file is unavailable' }); }
  });
  app.post('/api/movies/:id/reveal', async (request, reply) => {
    if (!isLoopback(request.socket.remoteAddress)) return reply.code(403).send({ error: 'Folder reveal is only available from localhost' });
    try { await playback.reveal(Number((request.params as any).id)); return reply.code(204).send(); } catch (error) { return reply.code(404).send({ error: error instanceof Error ? error.message : 'Movie file is unavailable' }); }
  });
  app.get('/api/movies/:id/playback', async (request, reply) => {
    const profileId = requireProfile(request);
    try { return await playback.source(Number((request.params as any).id), profileId); } catch (error) { return reply.code(404).send({ error: error instanceof Error ? error.message : 'Movie file is unavailable' }); }
  });
}
