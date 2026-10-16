/** What the metadata provider says people also watch after a title; cached so the provider is asked once per title. */
export const recommendationSignalsMigration = `
CREATE TABLE IF NOT EXISTS recommendation_signals (
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  recommended_ids_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (provider, provider_id, media_type)
);`;
