import { createReadStream } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { PlaybackService } from '../services/playbackService.js';
import { RangeError, StreamService } from '../services/streamService.js';

export function registerStreamRoutes(app: FastifyInstance, stream: StreamService, playback: PlaybackService): void {
  const serve = async (request: any, reply: any, includeBody: boolean) => {
    try {
      const result = await stream.open(Number(request.params.id), request.headers.range, includeBody);
      reply.code(result.statusCode).headers(result.headers); return result.stream ? reply.send(result.stream) : reply.send();
    } catch (error) {
      if (error instanceof RangeError) return reply.code(416).header('content-range', `bytes */${error.size}`).send();
      return reply.code(404).send({ error: error instanceof Error ? error.message : 'Movie file is unavailable' });
    }
  };
  app.get('/api/stream/:id', { exposeHeadRoute: false }, (request, reply) => serve(request, reply, true));
  app.head('/api/stream/:id', (request, reply) => serve(request, reply, false));
  app.get('/api/stream/:id/playlist.m3u', async (request: any, reply) => {
    try {
      const origin = `http://${request.headers.host}`; const body = await playback.playlistFor(Number(request.params.id), origin);
      return reply.header('content-type', 'audio/x-mpegurl').header('content-disposition', 'attachment; filename="movie.m3u"').send(body);
    } catch (error) { return reply.code(404).send({ error: error instanceof Error ? error.message : 'Movie file is unavailable' }); }
  });
  app.get('/api/movies/:id/subtitles/:order', async (request: any, reply) => {
    try {
      const file = await playback.subtitleFile(Number(request.params.id), Number(request.params.order));
      return reply.header('content-type', file.mimeType).send(createReadStream(file.path));
    } catch (error) { return reply.code(404).send({ error: error instanceof Error ? error.message : 'Subtitle file is unavailable' }); }
  });
}
