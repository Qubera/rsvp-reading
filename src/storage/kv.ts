/**
 * Универсальное key-value хранилище.
 *
 * Native → SQLite (таблица kv), Web → IndexedDB.
 * Оба драйвера реализуют один интерфейс, поэтому репозитории
 * не зависят от платформы. Данные живут только на устройстве —
 * приложение полностью офлайн.
 */

import { Platform } from 'react-native';

export interface KvDriver {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  /** Все ключи с заданным префиксом. */
  keys(prefix: string): Promise<string[]>;
}

let driver: KvDriver | null = null;
let initPromise: Promise<KvDriver> | null = null;

async function createDriver(): Promise<KvDriver> {
  if (Platform.OS === 'web') {
    const { IdbKvDriver } = await import('./idbDriver');
    return new IdbKvDriver('rsvp-reading', 'kv');
  }
  const { SqliteKvDriver } = await import('./sqliteDriver');
  return new SqliteKvDriver('rsvp.db');
}

export function getKv(): Promise<KvDriver> {
  if (driver) return Promise.resolve(driver);
  if (!initPromise) {
    initPromise = createDriver()
      .then((d) => {
        driver = d;
        return d;
      })
      .catch((e) => {
        initPromise = null;
        throw e;
      });
  }
  return initPromise;
}

// ----------------------- typed helpers -----------------------

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const d = await getKv();
  const raw = await d.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSetJson(key: string, value: unknown): Promise<void> {
  const d = await getKv();
  await d.set(key, JSON.stringify(value));
}

export async function kvDel(key: string): Promise<void> {
  const d = await getKv();
  await d.del(key);
}
