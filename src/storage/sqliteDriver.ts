/** SQLite-драйвер (iOS/Android) поверх expo-sqlite. */

import type { KvDriver } from './kv';

// Подключается только на native (см. kv.ts), web-сборка сюда не заходит.
import * as ExpoSQLite from 'expo-sqlite';

interface Db {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params: unknown[]): Promise<T[]>;
  runAsync(sql: string, params: unknown[]): Promise<unknown>;
}

export class SqliteKvDriver implements KvDriver {
  private db: Db | null = null;
  private ready: Promise<void>;

  constructor(name: string) {
    const sqlite = ExpoSQLite as unknown as {
      openDatabaseAsync(n: string, opts?: unknown): Promise<Db>;
    };
    this.ready = sqlite
      .openDatabaseAsync(name)
      .then(async (db) => {
        await db.execAsync(
          'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);',
        );
        this.db = db;
      });
  }

  private async rdy(): Promise<Db> {
    await this.ready;
    if (!this.db) throw new Error('SQLite driver not initialized');
    return this.db;
  }

  async get(key: string): Promise<string | null> {
    const db = await this.rdy();
    const row = await db.getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', [key]);
    return row ? row.v : null;
  }

  async set(key: string, value: string): Promise<void> {
    const db = await this.rdy();
    await db.runAsync(
      'INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v',
      [key, value],
    );
  }

  async del(key: string): Promise<void> {
    const db = await this.rdy();
    await db.runAsync('DELETE FROM kv WHERE k = ?', [key]);
  }

  async keys(prefix: string): Promise<string[]> {
    const db = await this.rdy();
    const rows = await db.getAllAsync<{ k: string }>('SELECT k FROM kv WHERE k LIKE ? ORDER BY k', [
      `${prefix}%`,
    ]);
    return rows.map((r) => r.k);
  }
}
