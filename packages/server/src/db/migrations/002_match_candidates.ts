export const matchCandidatesMigration = `
CREATE TABLE IF NOT EXISTS movie_match_candidates (
  id INTEGER PRIMARY KEY,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  title TEXT NOT NULL,
  year INTEGER,
  score REAL NOT NULL,
  rank INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS movie_match_candidates_movie_idx ON movie_match_candidates (movie_id);
`;
