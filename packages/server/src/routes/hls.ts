import { readFile } from 'node:fs/promises';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { SegmentNotFoundError } from '../services/hls/hlsSession.js';
import { SessionNotFoundError, type TranscodeSessionService } from '../services/hls/transcodeSessionService.js';
import type { TranscodeInfoService } from '../services/transcodeInfoService.js';

/** Route patterns; the GET ones also accept the per-movie `?key=` (routes/authGuard.ts). */
export const hlsRoutes = {
  playlist: '/api/hls/:id/:sessionId/main.m3u8',
  init: '/api/hls/:id/:sessionId/init.mp4',
  segment: '/api/hls/:id/:sessionId/seg-:n(^\\d+).m4s',
  session: '/api/hls/:id/:sessionId',
} as const;

interface HlsParams { id: string; sessionId: string; n?: string }

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof SessionNotFoundError || error instanceof SegmentNotFoundError) return reply.code(404).send({ error: error.message });
  return reply.code(500).send({ error: error instanceof Error ? error.message : 'Transcoding failed' });
}

async function sendFile(reply: FastifyReply, path: Promise<string>) {
  const body = await readFile(await path);
  return reply.header('content-type', 'video/mp4').header('cache-control', 'no-store').send(body);
}

export function registerHlsRoutes(app: FastifyInstance, sessions: TranscodeSessionService, info: TranscodeInfoService): void {
  app.get<{ Params: HlsParams }>(hlsRoutes.playlist, async (request, reply) => {
    try {
      const body = sessions.playlist(Number(request.params.id), request.params.sessionId);
      return reply.header('content-type', 'application/vnd.apple.mpegurl').header('cache-control', 'no-store').send(body);
    } catch (error) { return sendError(reply, error); }
  });
  app.get<{ Params: HlsParams }>(hlsRoutes.init, async (request, reply) => {
    try { return await sendFile(reply, sessions.init(Number(request.params.id), request.params.sessionId)); } catch (error) { return sendError(reply, error); }
  });
  app.get<{ Params: HlsParams }>(hlsRoutes.segment, async (request, reply) => {
    try {
      return await sendFile(reply, sessions.segment(Number(request.params.id), request.params.sessionId, Number(request.params.n)));
    } catch (error) { return sendError(reply, error); }
  });
  app.delete<{ Params: HlsParams }>(hlsRoutes.session, async (request, reply) => {
    try { await sessions.close(Number(request.params.id), request.params.sessionId); return reply.code(204).send(); } catch (error) { return sendError(reply, error); }
  });
  app.get('/api/transcode/encoders', async () => info.get());
}
