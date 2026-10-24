import type { FastifyInstance } from 'fastify';
import { playLocalRequestSchema, playbackRequestSchema } from '@ottlib/shared';
import { MovieUnavailableError, PlaybackService } from '../services/playbackService.js';
import { SessionBusyError } from '../services/hls/sessionOpener.js';
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
    // Any capability key in the query turns the direct/remux/transcode decision on; without one the answer is today's direct source.
    const query = (request.query ?? {}) as Record<string, unknown>;
    const asked = Object.keys(playbackRequestSchema.shape).some((key) => key in query);
    const parsed = asked ? playbackRequestSchema.safeParse(query) : undefined;
    if (parsed && !parsed.success) return reply.code(400).send({ error: 'Invalid playback request' });
    const device = request.headers['x-device-id'];
    try { return await playback.source(Number((request.params as any).id), profileId, parsed?.data, typeof device === 'string' ? device : undefined); } catch (error) {
      if (error instanceof SessionBusyError) return reply.code(503).send({ error: error.code, message: error.message });
      if (error instanceof MovieUnavailableError) return reply.code(404).send({ error: error.message });
      throw error;
    }
  });
}
