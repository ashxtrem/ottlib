import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { MEDIA_STATIC_EXTENSIONS, MEDIA_STATIC_FOLDERS } from '../config/mediaStatic.js';

const isImagePath = (pathname: string) => MEDIA_STATIC_EXTENSIONS.includes(extname(pathname).toLowerCase());

// Serves only the artwork folders, never the data folder itself (it holds library.sqlite and its -wal/-shm files).
export function registerMediaStatic(app: FastifyInstance, appDataPath: string) {
  for (const folder of MEDIA_STATIC_FOLDERS) {
    const root = join(appDataPath, folder);
    mkdirSync(root, { recursive: true });
    app.register(fastifyStatic, { root, prefix: `/media/${folder}/`, decorateReply: false, serveDotFiles: false, dotfiles: 'ignore', index: false, allowedPath: isImagePath });
  }
}
