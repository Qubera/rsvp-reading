/** IndexedDB-драйвер для web-сборки (тексты могут быть в мегабайты). */

import type { KvDriver } from './kv';

function openDb(name: string, store: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IdbKvDriver implements KvDriver {
  private dbp: Promise<IDBDatabase>;

  constructor(name: string, private store: string) {
    this.dbp = openDb(name, store);
  }

  private tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return this.dbp.then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction(this.store, mode);
          const req = fn(tx.objectStore(this.store));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );
  }

  async get(key: string): Promise<string | null> {
    const v = await this.tx<string | undefined>('readonly', (s) => s.get(key) as IDBRequest<string | undefined>);
    return v ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.tx('readwrite', (s) => s.put(value, key));
  }

  async del(key: string): Promise<void> {
    await this.tx('readwrite', (s) => s.delete(key));
  }

  async keys(prefix: string): Promise<string[]> {
    const all = await this.tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
    return all.filter((k) => typeof k === 'string' && k.startsWith(prefix)) as string[];
  }
}
