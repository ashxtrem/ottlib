import { createReadStream } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { embeddedSubtitleRetryAfterSeconds } from '../config/transcode.js';
import { EmbeddedSubtitleError, EmbeddedSubtitleService } from '../services/embeddedSubtitleService.js';
import { MovieUnavailableError, PlaybackService } from '../services/playbackService.js';

export const embeddedSubtitleRoute = '/api/movies/:id/subtitles/embedded/:order.vtt';

/**
 * An embedded text subtitle track as WebVTT: 200 once extracted, 202 + Retry-After while ffmpeg is still reading the file.
 * HEAD answers the same (a client probes readiness with it) and never sends a body.
 */
export function registerEmbeddedSubtitleRoutes(app: FastifyInstance, playback: PlaybackService, embedded: EmbeddedSubtitleService): void {
  const serve = async (request: FastifyRequest, reply: FastifyReply, includeBody: boolean) => {
    const params = request.params as { id: string; order: string };
    const id = Number(params.id); const order = Number(params.order);
    try {
      if (!Number.isInteger(id) || !Number.isInteger(order) || order < 0) throw new EmbeddedSubtitleError('Subtitle track is unavailable', 404);
      const result = await embedded.vtt(await playback.movieFile(id), order);
      if (result.state === 'extracting') {
        reply.code(202).header('retry-after', String(embeddedSubtitleRetryAfterSeconds));
        return includeBody ? reply.send({ status: 'extracting' }) : reply.send();
      }
      reply.header('content-type', 'text/vtt; charset=utf-8').header('content-length', result.size);
      return includeBody ? reply.send(createReadStream(result.path)) : reply.send();
    } catch (error) {
      if (error instanceof EmbeddedSubtitleError) return reply.code(error.status).send({ error: error.message });
      if (error instanceof MovieUnavailableError) return reply.code(404).send({ error: error.message });
      throw error;
    }
  };
  app.get(embeddedSubtitleRoute, { exposeHeadRoute: false }, (request, reply) => serve(request, reply, true));
  app.head(embeddedSubtitleRoute, (request, reply) => serve(request, reply, false));
}
