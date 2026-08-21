export const shelvesMigration = `
CREATE TABLE IF NOT EXISTS shelves (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS shelf_movies (
  shelf_id INTEGER NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (shelf_id, movie_id)
);
CREATE INDEX IF NOT EXISTS shelf_movies_shelf_position_idx ON shelf_movies (shelf_id, position);
CREATE INDEX IF NOT EXISTS shelf_movies_movie_idx ON shelf_movies (movie_id);
`;
