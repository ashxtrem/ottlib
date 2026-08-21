import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/db.js';
import { MovieRepository } from '../repositories/movieRepository.js';

const directories: string[] = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'ottlib-shelf-routes-')); directories.push(directory);
  const db = createDatabase(directory); db.prepare('INSERT INTO folders (path) VALUES (?)').run('E:/Movies');
  const movies = new MovieRepository(db);
  [1, 2].forEach((id) => movies.upsertScanned({ folderId: 1, path: `E:/Movies/${id}.mkv`, filename: `${id}.mkv`, title: `Movie ${id}`, year: 2024, size: 1, mtimeMs: id, seenAt: '2026-01-01T00:00:00.000Z' }));
  return { app: buildApp(db, directory, 0), db };
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true })));

describe('shelf routes', () => {
  it('creates, lists, updates memberships, and rejects duplicate names', async () => {
    const { app, db } = fixture();
    try {
      const created = await app.inject({ method: 'POST', url: '/api/shelves', payload: { name: 'Marvel', movieIds: [1, 2] } });
      expect(created.statusCode).toBe(200);
      const shelf = created.json() as { id: number; movieCount: number };
      expect(shelf.movieCount).toBe(2);
      const duplicate = await app.inject({ method: 'POST', url: '/api/shelves', payload: { name: 'marvel', movieIds: [1] } });
      expect(duplicate.statusCode).toBe(409);
      const memberships = await app.inject({ method: 'PUT', url: '/api/movies/1/shelves', payload: { shelfIds: [shelf.id], newShelfName: 'Favorites' } });
      expect(memberships.statusCode).toBe(200);
      expect((memberships.json() as { shelves: Array<{ name: string }> }).shelves.map((item) => item.name).sort()).toEqual(['Favorites', 'Marvel']);
      const summaries = await app.inject({ method: 'GET', url: '/api/shelves' });
      expect((summaries.json() as Array<{ name: string }>).map((item) => item.name)).toEqual(['Favorites', 'Marvel']);
    } finally { await app.close(); db.close(); }
  });
});
