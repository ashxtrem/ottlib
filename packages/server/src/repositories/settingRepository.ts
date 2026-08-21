import type Database from 'better-sqlite3';
import type { Settings, UpdateSettings } from '@ottlib/shared';
import { defaultSettings } from '../config/defaults.js';

export class SettingRepository {
  public constructor(private readonly db: Database.Database) {}

  public get(): Settings {
    const rows = this.db.prepare('SELECT key, value_json FROM settings').all() as Array<{ key: string; value_json: string }>;
    const stored = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value_json)]));
    return { ...defaultSettings, ...stored };
  }

  public update(update: UpdateSettings): Settings {
    const merged = { ...this.get(), ...update };
    const save = this.db.prepare('INSERT INTO settings (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json');
    const transaction = this.db.transaction(() => Object.entries(merged).forEach(([key, value]) => save.run(key, JSON.stringify(value))));
    transaction();
    return merged;
  }
}
