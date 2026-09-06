/**
 * DocumentRepository: CRUD документов.
 * Метаданные и полный текст хранятся раздельно — список библиотеки
 * никогда не тянет мегабайты текста.
 */

import type { Document, DocumentMeta, DocumentStatus } from '../../core/models/types';
import { kvDel, kvGetJson, kvSetJson, getKv } from '../../storage/kv';

const INDEX_KEY = 'docs:index';
const metaKey = (id: string) => `doc:meta:${id}`;
const textKey = (id: string) => `doc:text:${id}`;

export function toMeta(doc: Document): DocumentMeta {
  const { text: _text, ...meta } = doc;
  return meta;
}

export class DocumentRepository {
  async list(): Promise<DocumentMeta[]> {
    const ids = (await kvGetJson<string[]>(INDEX_KEY)) ?? [];
    const metas = await Promise.all(
      ids.map((id) => kvGetJson<DocumentMeta>(metaKey(id))),
    );
    return metas
      .filter((m): m is DocumentMeta => m !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<Document | null> {
    const meta = await kvGetJson<DocumentMeta>(metaKey(id));
    if (!meta) return null;
    const text = await kvGetJson<string>(textKey(id));
    if (text === null) return null;
    return { ...meta, text };
  }

  async save(doc: Document): Promise<void> {
    const ids = new Set((await kvGetJson<string[]>(INDEX_KEY)) ?? []);
    ids.add(doc.id);
    await kvSetJson(INDEX_KEY, Array.from(ids));
    await kvSetJson(metaKey(doc.id), toMeta(doc));
    await kvSetJson(textKey(doc.id), doc.text);
  }

  async updateProgress(
    id: string,
    currentWord: number,
    progress: number,
    status: DocumentStatus,
  ): Promise<void> {
    const meta = await kvGetJson<DocumentMeta>(metaKey(id));
    if (!meta) return;
    meta.currentWord = currentWord;
    meta.progress = progress;
    meta.status = status;
    meta.updatedAt = Date.now();
    await kvSetJson(metaKey(id), meta);
  }

  async rename(id: string, title: string): Promise<void> {
    const meta = await kvGetJson<DocumentMeta>(metaKey(id));
    if (!meta) return;
    meta.title = title.trim() || meta.title;
    meta.updatedAt = Date.now();
    await kvSetJson(metaKey(id), meta);
  }

  async delete(id: string): Promise<void> {
    const ids = (await kvGetJson<string[]>(INDEX_KEY)) ?? [];
    await kvSetJson(INDEX_KEY, ids.filter((x) => x !== id));
    await kvDel(metaKey(id));
    await kvDel(textKey(id));
    // каскад: чистим сессии чтения этого документа
    const kv = await getKv();
    const sessionIds = await kv.keys(`session:${id}:`);
    await Promise.all(sessionIds.map((k) => kv.del(k)));
  }
}
