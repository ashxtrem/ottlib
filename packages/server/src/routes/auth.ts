import type { FastifyInstance, FastifyReply } from 'fastify';
import { pinLoginSchema, removeAccessPinSchema, setAccessPinSchema } from '@ottlib/shared';
import { AccessPinError, AccessPinService } from '../services/accessPinService.js';
import { clearSessionCookie, sessionToken, setSessionCookie } from './sessionCookie.js';

export function registerAuthRoutes(app: FastifyInstance, pins: AccessPinService): void {
  app.get('/api/auth/status', async (request) => pins.status(sessionToken(request)));
  app.post('/api/auth/login', async (request, reply) => withPinErrors(reply, () => {
    const token = pins.login(pinLoginSchema.parse(request.body).pin, request.ip);
    setSessionCookie(reply, token); return { token };
  }));
  app.post('/api/auth/logout', async (request, reply) => { pins.logout(sessionToken(request)); clearSessionCookie(reply); return reply.code(204).send(); });
  app.put('/api/auth/pin', async (request, reply) => withPinErrors(reply, () => {
    const token = pins.setPin(setAccessPinSchema.parse(request.body), request.ip);
    setSessionCookie(reply, token); return { token };
  }));
  app.post('/api/auth/pin/remove', async (request, reply) => withPinErrors(reply, () => {
    pins.removePin(removeAccessPinSchema.parse(request.body).currentPin, request.ip);
    clearSessionCookie(reply); return reply.code(204).send();
  }));
}

function withPinErrors<T>(reply: FastifyReply, action: () => T): T | FastifyReply {
  try { return action(); } catch (error) {
    if (error instanceof AccessPinError) return reply.code(error.statusCode).send({ error: error.message });
    throw error;
  }
}
