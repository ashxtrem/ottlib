import type Database from 'better-sqlite3';
import type { ShelfCoverMovie, ShelfMembership } from '@ottlib/shared';

interface CoverRow { id: number; title: string; poster_file: string | null }
interface MembershipRow { movie_id: number; id: number; name: string }

export class ShelfMovieRepository {
  public constructor(private readonly db: Database.Database) {}

  public countForShelf(shelfId: number): number {
    return (this.db.prepare('SELECT COUNT(*) AS count FROM shelf_movies WHERE shelf_id = ?').get(shelfId) as { count: number }).count;
  }

  public listMovieIds(shelfId: number): number[] {
    const rows = this.db.prepare('SELECT movie_id FROM shelf_movies WHERE shelf_id = ? ORDER BY position, movie_id').all(shelfId) as Array<{ movie_id: number }>;
    return rows.map((row) => row.movie_id);
  }

  public listCoverMovies(shelfId: number, limit = 4): ShelfCoverMovie[] {
    const rows = this.db.prepare(`SELECT m.id, COALESCE(m.title_override, m.parsed_title) AS title, m.poster_file
      FROM shelf_movies sm JOIN movies m ON m.id = sm.movie_id
      WHERE sm.shelf_id = ? ORDER BY sm.position, sm.movie_id LIMIT ?`).all(shelfId, limit) as CoverRow[];
    return rows.map((row) => ({ id: row.id, title: row.title, posterUrl: row.poster_file ? `/media/posters/${encodeURIComponent(row.poster_file)}` : null }));
  }

  public listMemberships(movieIds: number[]): Map<number, ShelfMembership[]> {
    const result = new Map<number, ShelfMembership[]>();
    if (!movieIds.length) return result;
    const placeholders = movieIds.map(() => '?').join(', ');
    const rows = this.db.prepare(`SELECT sm.movie_id, s.id, s.name FROM shelf_movies sm JOIN shelves s ON s.id = sm.shelf_id
      WHERE sm.movie_id IN (${placeholders}) ORDER BY s.created_at DESC, s.id DESC`).all(...movieIds) as MembershipRow[];
    for (const row of rows) {
      const memberships = result.get(row.movie_id) ?? [];
      memberships.push({ id: row.id, name: row.name });
      result.set(row.movie_id, memberships);
    }
    return result;
  }

  public addMovies(shelfId: number, movieIds: number[]): void {
    if (!movieIds.length) return;
    const current = this.db.prepare('SELECT COALESCE(MAX(position), -1) AS position FROM shelf_movies WHERE shelf_id = ?').get(shelfId) as { position: number };
    const insert = this.db.prepare('INSERT OR IGNORE INTO shelf_movies (shelf_id, movie_id, position) VALUES (?, ?, ?)');
    let position = current.position + 1;
    for (const movieId of movieIds) {
      const result = insert.run(shelfId, movieId, position);
      if (result.changes) position += 1;
    }
  }

  public removeMovie(shelfId: number, movieId: number): boolean {
    return this.db.prepare('DELETE FROM shelf_movies WHERE shelf_id = ? AND movie_id = ?').run(shelfId, movieId).changes > 0;
  }

  public ensureMovieShelves(movieId: number, shelfIds: number[]): void {
    const current = this.db.prepare('SELECT shelf_id FROM shelf_movies WHERE movie_id = ?').all(movieId) as Array<{ shelf_id: number }>;
    const desired = new Set(shelfIds);
    const remove = this.db.prepare('DELETE FROM shelf_movies WHERE shelf_id = ? AND movie_id = ?');
    for (const membership of current) if (!desired.has(membership.shelf_id)) remove.run(membership.shelf_id, movieId);
    const existing = new Set(current.map((membership) => membership.shelf_id));
    for (const shelfId of shelfIds) if (!existing.has(shelfId)) this.addMovies(shelfId, [movieId]);
  }

  public replaceOrder(shelfId: number, movieIds: number[]): void {
    const update = this.db.prepare('UPDATE shelf_movies SET position = ? WHERE shelf_id = ? AND movie_id = ?');
    movieIds.forEach((movieId, position) => update.run(position, shelfId, movieId));
  }
}
