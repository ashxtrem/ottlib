import type Database from 'better-sqlite3';

export interface RecommendationSignal { providerIds: string[]; fetchedAt: string }

export class RecommendationSignalRepository {
  public constructor(private readonly db: Database.Database) {}

  public get(provider: string, providerId: string, mediaType: string): RecommendationSignal | undefined {
    const row = this.db.prepare('SELECT recommended_ids_json, fetched_at FROM recommendation_signals WHERE provider = ? AND provider_id = ? AND media_type = ?')
      .get(provider, providerId, mediaType) as { recommended_ids_json: string; fetched_at: string } | undefined;
    return row && { providerIds: JSON.parse(row.recommended_ids_json) as string[], fetchedAt: row.fetched_at };
  }

  public put(provider: string, providerId: string, mediaType: string, providerIds: string[], fetchedAt: string): void {
    this.db.prepare(`INSERT INTO recommendation_signals (provider, provider_id, media_type, recommended_ids_json, fetched_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(provider, provider_id, media_type) DO UPDATE SET recommended_ids_json = excluded.recommended_ids_json, fetched_at = excluded.fetched_at`)
      .run(provider, providerId, mediaType, JSON.stringify(providerIds), fetchedAt);
  }
}
