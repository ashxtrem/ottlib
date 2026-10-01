import type { FastifyReply, FastifyRequest } from 'fastify';

const cookieName = 'ottlib_session';
const oneYearSeconds = 365 * 24 * 60 * 60;

/** The session token from `Authorization: Bearer …` (native apps) or the session cookie (web app, <img>, <video>). */
export function sessionToken(request: FastifyRequest): string | undefined {
  const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '')?.[1];
  if (bearer) return bearer;
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === cookieName) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.header('set-cookie', `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${oneYearSeconds}`);
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.header('set-cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
