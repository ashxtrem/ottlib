import type Database from 'better-sqlite3';
import type { MediaTrack } from '@ottlib/shared';

interface MediaTrackRow {
  movie_id: number;
  track_type: MediaTrack['type'];
  track_source: MediaTrack['source'];
  track_order: number;
  language: string | null;
  title: string | null;
  codec: string | null;
  channels: number | null;
  channel_layout: string | null;
  is_default: number;
  is_forced: number;
  is_hearing_impaired: number;
}

export class MediaTrackRepository {
  public constructor(private readonly db: Database.Database) {}

  public clearForMovie(movieId: number): void {
    this.db.prepare('DELETE FROM media_tracks WHERE movie_id = ?').run(movieId);
  }

  public replaceForMovie(movieId: number, tracks: MediaTrack[]): void {
    const replace = this.db.transaction((items: MediaTrack[]) => {
      this.clearForMovie(movieId);
      const insert = this.db.prepare(`INSERT INTO media_tracks (
        movie_id, track_type, track_source, track_order, language, title, codec, channels, channel_layout, is_default, is_forced, is_hearing_impaired
      ) VALUES (@movieId, @type, @source, @order, @language, @title, @codec, @channels, @channelLayout, @isDefault, @isForced, @isHearingImpaired)`);
      items.forEach((track) => insert.run({ ...track, movieId, isDefault: Number(track.isDefault), isForced: Number(track.isForced), isHearingImpaired: Number(track.isHearingImpaired) }));
    });
    replace(tracks);
  }

  public listByMovieIds(movieIds: number[]): Map<number, MediaTrack[]> {
    if (!movieIds.length) return new Map();
    const placeholders = movieIds.map(() => '?').join(', ');
    const rows = this.db.prepare(`SELECT movie_id, track_type, track_source, track_order, language, title, codec, channels, channel_layout, is_default, is_forced, is_hearing_impaired
      FROM media_tracks WHERE movie_id IN (${placeholders}) ORDER BY movie_id, track_order`).all(...movieIds) as MediaTrackRow[];
    return rows.reduce((byMovie, row) => {
      const tracks = byMovie.get(row.movie_id) ?? [];
      tracks.push({
        type: row.track_type, source: row.track_source, order: row.track_order, language: row.language, title: row.title, codec: row.codec,
        channels: row.channels, channelLayout: row.channel_layout, isDefault: Boolean(row.is_default), isForced: Boolean(row.is_forced), isHearingImpaired: Boolean(row.is_hearing_impaired)
      });
      byMovie.set(row.movie_id, tracks);
      return byMovie;
    }, new Map<number, MediaTrack[]>());
  }
}
